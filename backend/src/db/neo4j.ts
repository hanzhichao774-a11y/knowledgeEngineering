import neo4j, { type Driver, type Session } from 'neo4j-driver';
import { EMBEDDING_DIMENSION } from '../services/EmbeddingService.js';

let driver: Driver | null = null;

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

export function initNeo4j(config?: Neo4jConfig): Driver | null {
  const uri = config?.uri || process.env.NEO4J_URI || 'bolt://localhost:7687';
  const username = config?.username || process.env.NEO4J_USERNAME || 'neo4j';
  const password = config?.password || process.env.NEO4J_PASSWORD || '';

  if (!password) {
    console.warn('Neo4j password not configured, running in mock mode');
    return null;
  }

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    console.log(`Neo4j connected to ${uri}`);
    ensureVectorIndex().catch((err) => {
      console.warn('[Neo4j] Vector index creation skipped:', (err as Error).message);
    });
    return driver;
  } catch (err) {
    console.error('Failed to connect to Neo4j:', err);
    return null;
  }
}

export function getDriver(): Driver | null {
  return driver;
}

export async function withSession<T>(fn: (session: Session) => Promise<T>): Promise<T | null> {
  if (!driver) return null;
  const session = driver.session();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

export interface OntologyInput {
  classes?: Array<{ name: string; desc: string }>;
  entities?: Array<{ name: string; class: string; desc: string }>;
  relations?: Array<{ name: string; source: string; target: string; desc: string }>;
  attributes?: Array<{ name: string; entity: string; value: string; desc: string }>;
}

export async function writeOntologyToGraph(ontology: OntologyInput) {
  return withSession(async (session) => {
    let nodesWritten = 0;
    let edgesWritten = 0;

    for (const cls of ontology.classes ?? []) {
      await session.run(
        `MERGE (n:Class {name: $name})
         SET n.description = $desc, n.nodeType = 'class', n.updatedAt = datetime()`,
        { name: cls.name, desc: cls.desc },
      );
      nodesWritten++;
    }

    for (const entity of ontology.entities ?? []) {
      const label = sanitizeLabel(entity.class || 'Entity');
      await session.run(
        `MERGE (n:Entity {name: $name})
         SET n.description = $desc, n.class = $cls, n.nodeType = 'entity', n.updatedAt = datetime()
         WITH n
         CALL { WITH n SET n:${label} } IN TRANSACTIONS OF 1 ROW`,
        { name: entity.name, desc: entity.desc, cls: entity.class },
      ).catch(async () => {
        await session.run(
          `MERGE (n:Entity {name: $name})
           SET n.description = $desc, n.class = $cls, n.nodeType = 'entity', n.updatedAt = datetime()`,
          { name: entity.name, desc: entity.desc, cls: entity.class },
        );
      });
      nodesWritten++;
    }

    for (const rel of ontology.relations ?? []) {
      const relType = sanitizeRelType(rel.name);
      try {
        await session.run(
          `MATCH (a:Entity {name: $source}), (b:Entity {name: $target})
           MERGE (a)-[r:${relType}]->(b)
           SET r.description = $desc`,
          { source: rel.source, target: rel.target, desc: rel.desc },
        );
        edgesWritten++;
      } catch (e) {
        console.warn(`[Neo4j] Failed to write relation ${rel.source}-[${rel.name}]->${rel.target}:`, (e as Error).message);
      }
    }

    const entitySearchTexts = new Map<string, string[]>();

    for (const attr of ontology.attributes ?? []) {
      const propKey = sanitizePropKey(attr.name);
      try {
        await session.run(
          `MATCH (n:Entity {name: $entity})
           SET n.${propKey} = $value`,
          { entity: attr.entity, value: attr.value },
        );
        const parts = entitySearchTexts.get(attr.entity) ?? [];
        parts.push(`${attr.name}:${attr.value}`);
        entitySearchTexts.set(attr.entity, parts);
      } catch {
        // property key might be invalid — skip silently
      }
    }

    for (const [entityName, parts] of entitySearchTexts) {
      const searchText = parts.join(' | ');
      try {
        await session.run(
          `MATCH (n:Entity {name: $name})
           SET n._searchText = COALESCE(n._searchText, '') + ' | ' + $text`,
          { name: entityName, text: searchText },
        );
      } catch {
        // non-critical
      }
    }

    console.log(`[Neo4j] Written: ${nodesWritten} nodes, ${edgesWritten} edges`);
    return { success: true, nodesWritten, edgesWritten };
  });
}

function sanitizeLabel(s: string): string {
  return s.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').replace(/^_+|_+$/g, '') || 'Entity';
}

function sanitizeRelType(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fff_]/g, '_').replace(/^_+|_+$/g, '') || 'RELATED_TO';
}

function sanitizePropKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9\u4e00-\u9fff_]/g, '_').replace(/^_+|_+$/g, '') || 'prop';
}

export async function readGraphData(limit = 100) {
  return withSession(async (session) => {
    const nodesResult = await session.run(
      `MATCH (n)
       WHERE NOT n:Chunk
       RETURN n.name AS label, COALESCE(n.nodeType, 'entity') AS nodeType,
              labels(n) AS allLabels, id(n) AS id
       LIMIT $limit`,
      { limit: neo4j.int(limit) },
    );

    const edgesResult = await session.run(
      `MATCH (a)-[r]->(b)
       WHERE NOT a:Chunk AND NOT b:Chunk
       RETURN id(a) AS source, id(b) AS target, type(r) AS label, r.description AS desc
       LIMIT $limit`,
      { limit: neo4j.int(limit) },
    );

    return {
      nodes: nodesResult.records.map((r) => ({
        id: r.get('id').toString(),
        label: r.get('label') as string,
        type: r.get('nodeType') as string,
      })),
      edges: edgesResult.records.map((r) => ({
        source: r.get('source').toString(),
        target: r.get('target').toString(),
        label: (r.get('label') as string).replace(/_/g, ' ').toLowerCase(),
      })),
    };
  });
}

export async function getKnowledgeStatus() {
  return withSession(async (session) => {
    const nodeCount = await session.run('MATCH (n) RETURN count(n) AS cnt');
    const edgeCount = await session.run('MATCH ()-[r]->() RETURN count(r) AS cnt');
    return {
      nodeCount: (nodeCount.records[0]?.get('cnt') as { toNumber(): number })?.toNumber() ?? 0,
      edgeCount: (edgeCount.records[0]?.get('cnt') as { toNumber(): number })?.toNumber() ?? 0,
    };
  });
}

export function isNeo4jConnected(): boolean {
  return driver !== null;
}

export async function queryByKeywords(keywords: string[], limit = 30) {
  return withSession(async (session) => {
    const result = await session.run(
      `MATCH (n)
       WHERE any(k IN $keywords WHERE
         toLower(n.name) CONTAINS toLower(k) OR
         toLower(COALESCE(n.description,'')) CONTAINS toLower(k) OR
         toLower(COALESCE(n._searchText,'')) CONTAINS toLower(k))
       OPTIONAL MATCH (n)-[r]-(m)
       RETURN n.name AS name, labels(n)[0] AS type, n.description AS desc,
              properties(n) AS props,
              collect(DISTINCT {rel: type(r), target: m.name, targetDesc: m.description}) AS relations
       LIMIT $limit`,
      { keywords, limit: neo4j.int(limit) },
    );
    return result.records.map((r) => {
      const props = r.get('props') as Record<string, unknown>;
      const { name, description, nodeType, class: _cls, updatedAt, _searchText, ...attributes } = props;
      return {
        name: r.get('name') as string,
        type: (r.get('type') as string || 'entity').toLowerCase(),
        desc: r.get('desc') as string | null,
        attributes,
        relations: (r.get('relations') as Array<{ rel: string; target: string; targetDesc: string }>)
          .filter((rel) => rel.target != null),
      };
    });
  });
}

const SAFE_CYPHER_RE = /^\s*(MATCH|OPTIONAL\s+MATCH|WITH|WHERE|RETURN|ORDER\s+BY|LIMIT|SKIP|UNWIND|CALL)\b/i;

export async function runCypher(cypher: string, params: Record<string, unknown> = {}) {
  const statements = cypher.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    if (!SAFE_CYPHER_RE.test(stmt)) {
      throw new Error(`Unsafe Cypher blocked: ${stmt.slice(0, 60)}...`);
    }
  }

  return withSession(async (session) => {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject());
  });
}

export async function getGraphSchema() {
  return withSession(async (session) => {
    const labels = await session.run('CALL db.labels() YIELD label RETURN collect(label) AS labels');
    const relTypes = await session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS types');
    return {
      nodeLabels: labels.records[0]?.get('labels') as string[] ?? [],
      relationshipTypes: relTypes.records[0]?.get('types') as string[] ?? [],
    };
  });
}

export async function closeNeo4j() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

// ──────────────────────────────────────────
// Vector index & Chunk operations
// ──────────────────────────────────────────

const VECTOR_INDEX_NAME = 'chunk_embedding';

async function ensureVectorIndex(): Promise<void> {
  await withSession(async (session) => {
    try {
      await session.run(
        `CREATE VECTOR INDEX ${VECTOR_INDEX_NAME} IF NOT EXISTS
         FOR (c:Chunk) ON c.embedding
         OPTIONS {indexConfig: {
           \`vector.dimensions\`: ${EMBEDDING_DIMENSION},
           \`vector.similarity_function\`: 'cosine'
         }}`,
      );
      console.log(`[Neo4j] Vector index '${VECTOR_INDEX_NAME}' ensured (${EMBEDDING_DIMENSION}d, cosine)`);
    } catch (err) {
      console.warn('[Neo4j] Vector index creation warning:', (err as Error).message);
    }
  });
}

export interface ChunkInput {
  text: string;
  embedding: number[];
  position: number;
  source: string;
}

export async function storeChunks(chunks: ChunkInput[]): Promise<number> {
  if (chunks.length === 0) return 0;

  return (await withSession(async (session) => {
    let stored = 0;
    for (const chunk of chunks) {
      try {
        await session.run(
          `CREATE (c:Chunk {
             text: $text,
             embedding: $embedding,
             position: $position,
             source: $source,
             nodeType: 'chunk',
             createdAt: datetime()
           })`,
          {
            text: chunk.text,
            embedding: chunk.embedding,
            position: neo4j.int(chunk.position),
            source: chunk.source,
          },
        );
        stored++;
      } catch (err) {
        console.warn(`[Neo4j] Failed to store chunk ${chunk.position}:`, (err as Error).message);
      }
    }
    console.log(`[Neo4j] Stored ${stored}/${chunks.length} chunks`);
    return stored;
  })) ?? 0;
}

export async function linkChunksToEntities(entityNames: string[]): Promise<number> {
  if (entityNames.length === 0) return 0;

  return (await withSession(async (session) => {
    let linked = 0;
    for (const entityName of entityNames) {
      try {
        const result = await session.run(
          `MATCH (e:Entity {name: $name}), (c:Chunk)
           WHERE c.text CONTAINS $name
           MERGE (e)-[:EXTRACTED_FROM]->(c)
           RETURN count(*) AS cnt`,
          { name: entityName },
        );
        const cnt = (result.records[0]?.get('cnt') as { toNumber(): number })?.toNumber() ?? 0;
        if (cnt > 0) linked += cnt;
      } catch {
        // non-critical
      }
    }
    console.log(`[Neo4j] Created ${linked} EXTRACTED_FROM links`);
    return linked;
  })) ?? 0;
}

export async function vectorSearch(queryEmbedding: number[], topK = 5): Promise<Array<{ text: string; source: string; position: number; score: number }>> {
  const results = await withSession(async (session) => {
    try {
      const result = await session.run(
        `CALL db.index.vector.queryNodes($indexName, $topK, $embedding)
         YIELD node, score
         RETURN node.text AS text, node.source AS source,
                node.position AS position, score
         ORDER BY score DESC`,
        {
          indexName: VECTOR_INDEX_NAME,
          topK: neo4j.int(topK),
          embedding: queryEmbedding,
        },
      );
      return result.records.map((r) => ({
        text: r.get('text') as string,
        source: r.get('source') as string,
        position: typeof r.get('position') === 'object'
          ? (r.get('position') as { toNumber(): number }).toNumber()
          : (r.get('position') as number),
        score: r.get('score') as number,
      }));
    } catch (err) {
      console.warn('[Neo4j] Vector search failed:', (err as Error).message);
      return [];
    }
  });
  return results ?? [];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
