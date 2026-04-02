import neo4j, { type Driver, type Session } from 'neo4j-driver';

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

export async function writeOntologyToGraph(ontology: {
  entities: Array<{ name: string; type: string; desc: string }>;
}) {
  return withSession(async (session) => {
    for (const entity of ontology.entities) {
      if (entity.type === 'entity' || entity.type === 'concept' || entity.type === 'attr') {
        await session.run(
          `MERGE (n:${capitalize(entity.type)} {name: $name})
           SET n.description = $desc, n.updatedAt = datetime()`,
          { name: entity.name, desc: entity.desc }
        );
      }
    }

    for (const entity of ontology.entities) {
      if (entity.type === 'relation') {
        const parts = entity.desc.split('→').map((s) => s.trim());
        if (parts.length === 2) {
          await session.run(
            `MATCH (a {name: $from}), (b {name: $to})
             MERGE (a)-[r:${entity.name.toUpperCase().replace(/\s/g, '_')}]->(b)`,
            { from: parts[0], to: parts[1] }
          );
        }
      }
    }

    return { success: true };
  });
}

export async function readGraphData(limit = 50) {
  return withSession(async (session) => {
    const nodesResult = await session.run(
      'MATCH (n) RETURN n.name AS label, labels(n)[0] AS type, id(n) AS id LIMIT $limit',
      { limit: neo4j.int(limit) }
    );

    const edgesResult = await session.run(
      'MATCH (a)-[r]->(b) RETURN id(a) AS source, id(b) AS target, type(r) AS label LIMIT $limit',
      { limit: neo4j.int(limit) }
    );

    return {
      nodes: nodesResult.records.map((r) => ({
        id: r.get('id').toString(),
        label: r.get('label'),
        type: (r.get('type') || 'entity').toLowerCase(),
      })),
      edges: edgesResult.records.map((r) => ({
        source: r.get('source').toString(),
        target: r.get('target').toString(),
        label: r.get('label').replace(/_/g, ' ').toLowerCase(),
      })),
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
       WHERE any(k IN $keywords WHERE n.name CONTAINS k OR n.description CONTAINS k)
       OPTIONAL MATCH (n)-[r]-(m)
       RETURN n.name AS name, labels(n)[0] AS type, n.description AS desc,
              collect(DISTINCT {rel: type(r), target: m.name}) AS relations
       LIMIT $limit`,
      { keywords, limit: neo4j.int(limit) },
    );
    return result.records.map((r) => ({
      name: r.get('name') as string,
      type: (r.get('type') as string || 'entity').toLowerCase(),
      desc: r.get('desc') as string | null,
      relations: (r.get('relations') as Array<{ rel: string; target: string }>)
        .filter((rel) => rel.target != null),
    }));
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
