# Architecture

graphify is no longer just a graph builder. It is a local `LLM knowledge base system` with an agent-facing service layer.

The design goal is:

- keep raw sources immutable
- normalize messy inputs into reusable sidecars
- compile graph knowledge and row-level records side by side
- expose the compiled corpus to users and other agents through CLI and MCP
- preserve explicit health checks and room for write-back memory

## Pipeline

```text
raw sources
  -> detect()
  -> normalize()           # MinerU-first for PDF when available
  -> extract()/semantic
  -> build_graph()
  -> cluster()/analyze()
  -> report()/export()
  -> build_knowledge_assets()
  -> agent / MCP service
```

The graph pipeline still matters, but it now feeds a broader asset layer under `graphify-out/`.

## Knowledge assets

`graphify-out/` is the compiled corpus. The important subdirectories are:

| Path | Purpose |
|------|---------|
| `raw/source_index.json` | source inventory and detection metadata |
| `normalized/normalized_index.json` | normalized sidecars, especially converted PDF/Office/table inputs |
| `records/records.jsonl` | structured record store for tables, stats, and time-series rows |
| `graph/graph.json` | copied graph asset for service workflows |
| `reports/GRAPH_REPORT.md` | copied briefing/report asset |
| `memory/` | write-back space for derived Q&A and briefings |
| `health/health.json` | machine-readable coverage/confidence report |
| `health/HEALTH_REPORT.md` | human-readable health summary |
| `assets.json` | manifest of the compiled asset set |

This means graphify can answer questions from more than one representation:

- graph topology for relationships and bridge concepts
- structured records for exact row-level facts
- reports for orientation
- health data for gap detection

## Module responsibilities

| Module | Responsibility |
|--------|----------------|
| `detect.py` | collect/classify files and drive incremental detection |
| `normalize.py` | convert PDF, Office, delimited, and structured text sources into markdown sidecars |
| `extract.py` | deterministic AST extraction for code |
| `build.py` | merge extraction fragments into a NetworkX graph |
| `cluster.py` | assign community ids using graph topology |
| `analyze.py` | compute god nodes, surprising connections, and suggested questions |
| `report.py` | render markdown audit reports |
| `export.py` | export graph HTML/JSON/GraphML/SVG/Obsidian outputs |
| `assets.py` | build the explicit knowledge-asset layout under `graphify-out/` |
| `health.py` | score coverage, MinerU usage, ambiguous edges, and memory gaps |
| `agent.py` | service-layer retrieval across graph and record assets |
| `serve.py` | MCP stdio server exposing graph and knowledge-base tools |
| `ingest.py` | fetch/save remote sources into the corpus |
| `cache.py` | semantic extraction cache keyed by file hash |
| `validate.py` | schema validation for extraction payloads |

## Normalization strategy

Normalization is what allows graphify to behave like a knowledge-base compiler instead of a best-effort file reader.

- Plain code and markdown can be read directly.
- PDF inputs now prefer the external `mineru` CLI when available.
- MinerU output is folded into normalized sidecars with provenance in frontmatter.
- If MinerU is unavailable, PDF falls back to local text extraction.
- Delimited and structured-text files are rewritten into markdown plus explicit row records.

The sidecar layer is intentionally LLM-friendly and machine-auditable.

## Service layer

The external interface is an agent, not a display layer.

### CLI

- `graphify agent "<question>" --format direct|evidence|structured|artifact`
- `graphify assets build`
- `graphify health`

### MCP tools

- `query_graph`
- `ask_kb`
- `search_records`
- `get_health`

This lets another agent consume graphify as a local knowledge service without reopening raw documents.

## Health model

`health.py` exists to keep the corpus honest. Current checks include:

- detected sources with no graph-backed representation
- PDF normalization that did not use MinerU
- low-confidence inferred edges
- ambiguous edges
- empty memory/write-back state

The goal is not just answering questions, but exposing when the knowledge base is incomplete.

## Memory and compounding

The long-term model is:

```text
raw -> normalize -> compile -> answer -> write back -> re-index
```

The current implementation provides the `memory/` asset boundary and indexes it into the health layer. That keeps the system ready for explicit write-back workflows instead of relying on transient chat context.

## Security

All external input passes through `graphify/security.py` before use:

- URLs -> `validate_url()` and `safe_fetch()` / `safe_fetch_text()`
- graph paths -> `validate_graph_path()`
- labels -> `sanitize_label()`

The service layer only reads graph assets from inside `graphify-out/`.

## Testing

Run:

```bash
pytest tests/ -q
```

The most important tests now cover:

- graph query helpers
- asset generation
- service-agent retrieval
- health report generation
