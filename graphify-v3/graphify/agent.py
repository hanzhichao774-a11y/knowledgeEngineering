from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import networkx as nx
from networkx.readwrite import json_graph


def tokenize_query(question: str) -> list[str]:
    lowered = question.lower()
    terms = [t for t in re.findall(r"[a-z0-9_]+", lowered) if len(t) > 1]
    cjk_chunks = re.findall(r"[\u3400-\u9fff]+", question)
    for chunk in cjk_chunks:
        if len(chunk) <= 4:
            terms.append(chunk)
        else:
            terms.append(chunk)
            terms.extend(chunk[i : i + 2] for i in range(len(chunk) - 1))
            terms.extend(chunk[i : i + 3] for i in range(len(chunk) - 2))
    seen: set[str] = set()
    deduped: list[str] = []
    for term in terms:
        if term and term not in seen:
            seen.add(term)
            deduped.append(term)
    return deduped


def _load_graph(root: Path, graph_path: str = "graphify-out/graph.json") -> nx.Graph:
    path = (root / graph_path) if not Path(graph_path).is_absolute() else Path(graph_path)
    if not path.exists():
        return nx.Graph()
    data = json.loads(path.read_text(encoding="utf-8"))
    return json_graph.node_link_graph(data, edges="links")


def _load_records(root: Path) -> list[dict[str, Any]]:
    path = root / "graphify-out" / "records" / "records.jsonl"
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        records.append(json.loads(line))
    return records


def _score_text_blob(blob: str, terms: list[str]) -> float:
    lowered = blob.lower()
    return sum(1.0 for term in terms if term in lowered)


def search_records(question: str, root: Path, *, top_n: int = 10) -> list[dict[str, Any]]:
    terms = tokenize_query(question)
    scored: list[tuple[float, dict[str, Any]]] = []
    for record in _load_records(Path(root)):
        record_blob = json.dumps(record.get("record_json", {}), ensure_ascii=False)
        score = 0.0
        score += 2.0 * _score_text_blob(str(record.get("label", "")), terms)
        score += 2.0 * _score_text_blob(str(record.get("record_key", "")), terms)
        score += 1.0 * _score_text_blob(record_blob, terms)
        score += 0.5 * _score_text_blob(str(record.get("source_file", "")), terms)
        if score > 0:
            scored.append((score, record))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [record for _, record in scored[:top_n]]


def search_graph_nodes(question: str, root: Path, *, top_n: int = 10, graph_path: str = "graphify-out/graph.json") -> list[dict[str, Any]]:
    G = _load_graph(Path(root), graph_path)
    if G.number_of_nodes() == 0:
        return []
    terms = tokenize_query(question)
    scored: list[tuple[float, dict[str, Any]]] = []
    for node_id, data in G.nodes(data=True):
        label = str(data.get("label", ""))
        source_file = str(data.get("source_file", ""))
        score = 2.0 * _score_text_blob(label, terms) + 0.5 * _score_text_blob(source_file, terms)
        if score > 0:
            scored.append(
                (
                    score,
                    {
                        "id": node_id,
                        "label": label or node_id,
                        "source_file": source_file,
                        "source_location": data.get("source_location"),
                        "community": data.get("community"),
                        "degree": G.degree(node_id),
                        "record_key": data.get("record_key"),
                    },
                )
            )
    scored.sort(key=lambda item: (item[0], item[1]["degree"]), reverse=True)
    return [record for _, record in scored[:top_n]]


def build_evidence_pack(question: str, root: Path, *, graph_path: str = "graphify-out/graph.json", top_n: int = 5) -> dict[str, Any]:
    root = Path(root)
    records = search_records(question, root, top_n=top_n)
    nodes = search_graph_nodes(question, root, top_n=top_n, graph_path=graph_path)
    sources = sorted(
        {
            *[record.get("source_file") for record in records if record.get("source_file")],
            *[node.get("source_file") for node in nodes if node.get("source_file")],
        }
    )
    return {
        "question": question,
        "records": records,
        "nodes": nodes,
        "sources": sources,
    }


def _record_to_line(record: dict[str, Any]) -> str:
    payload = record.get("record_json") or {}
    if isinstance(payload, dict) and payload:
        preview = ", ".join(f"{key}={value}" for key, value in list(payload.items())[:4])
        return f"- {record.get('label')} ({preview})"
    return f"- {record.get('label')}"


def render_direct_answer(evidence: dict[str, Any]) -> str:
    if not evidence["records"] and not evidence["nodes"]:
        return "No matching knowledge found in the current knowledge base."

    lines: list[str] = []
    if evidence["records"]:
        lines.append("Top matching records:")
        lines.extend(_record_to_line(record) for record in evidence["records"][:5])

    if evidence["nodes"]:
        if lines:
            lines.append("")
        lines.append("Related graph nodes:")
        for node in evidence["nodes"][:5]:
            source = f" [{node.get('source_file')}]" if node.get("source_file") else ""
            lines.append(f"- {node.get('label')}{source}")

    if evidence["sources"]:
        lines.append("")
        lines.append("Sources:")
        lines.extend(f"- {source}" for source in evidence["sources"])

    return "\n".join(lines)


def render_evidence_pack(evidence: dict[str, Any]) -> str:
    return json.dumps(evidence, ensure_ascii=False, indent=2)


def render_artifact(evidence: dict[str, Any]) -> str:
    lines = [f"# Knowledge Briefing", "", f"Question: {evidence['question']}", ""]
    if evidence["records"]:
        lines.extend(["## Structured Findings"] + [_record_to_line(record) for record in evidence["records"]])
    if evidence["nodes"]:
        lines.extend(["", "## Related Graph Nodes"])
        for node in evidence["nodes"]:
            lines.append(
                f"- {node.get('label')} (community={node.get('community')}, source={node.get('source_file')})"
            )
    if evidence["sources"]:
        lines.extend(["", "## Sources"] + [f"- {source}" for source in evidence["sources"]])
    return "\n".join(lines).strip() + "\n"


def answer(
    question: str,
    root: Path,
    *,
    output_format: str = "direct",
    graph_path: str = "graphify-out/graph.json",
    top_n: int = 5,
) -> str:
    evidence = build_evidence_pack(question, root, graph_path=graph_path, top_n=top_n)
    if output_format == "structured":
        return render_evidence_pack(evidence)
    if output_format == "evidence":
        return render_evidence_pack(evidence)
    if output_format == "artifact":
        return render_artifact(evidence)
    return render_direct_answer(evidence)
