from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _source_tokens(value: str | None) -> set[str]:
    if not value:
        return set()
    text = str(value).strip()
    if not text:
        return set()
    path = Path(text)
    return {text.lower(), path.name.lower()}


def _entry_matches_source(entry: dict[str, Any], represented_tokens: set[str]) -> bool:
    source_path = entry.get("source_path")
    normalized_path = entry.get("normalized_path")
    for token in _source_tokens(source_path) | _source_tokens(normalized_path):
        if token in represented_tokens:
            return True
    return False


def build_health_report(
    *,
    source_index: list[dict[str, Any]],
    normalized_index: list[dict[str, Any]],
    memory_index: list[dict[str, Any]],
    graph_data: dict[str, Any],
) -> dict[str, Any]:
    nodes = graph_data.get("nodes", [])
    links = graph_data.get("links", [])

    represented_tokens: set[str] = set()
    for node in nodes:
        represented_tokens |= _source_tokens(node.get("source_file"))

    unrepresented_sources = [
        entry for entry in source_index if not _entry_matches_source(entry, represented_tokens)
    ]

    record_nodes = [node for node in nodes if node.get("record_json") is not None]
    ambiguous_edges = [edge for edge in links if edge.get("confidence") == "AMBIGUOUS"]
    inferred_edges = [edge for edge in links if edge.get("confidence") == "INFERRED"]
    low_confidence_edges = [
        edge
        for edge in links
        if isinstance(edge.get("confidence_score"), (int, float)) and edge["confidence_score"] < 0.5
    ]

    mineru_normalized = [
        entry for entry in normalized_index if entry.get("normalized_from") == "mineru"
    ]
    pdf_normalized = [
        entry for entry in normalized_index if entry.get("normalized_from") in {"pdf", "mineru"}
    ]

    warnings: list[str] = []
    if unrepresented_sources:
        warnings.append(
            f"{len(unrepresented_sources)} source file(s) were detected but produced no graph-backed knowledge nodes."
        )
    if pdf_normalized and not mineru_normalized:
        warnings.append(
            "PDF normalization is not using MinerU. Scanned pages and image-only tables may still be under-extracted."
        )
    if low_confidence_edges:
        warnings.append(
            f"{len(low_confidence_edges)} low-confidence edge(s) need review before they are treated as trusted knowledge."
        )
    if ambiguous_edges:
        warnings.append(
            f"{len(ambiguous_edges)} ambiguous edge(s) are present in the graph and should remain review-only."
        )
    if not memory_index:
        warnings.append(
            "No derived memory artifacts have been written back yet. The system is not compounding from Q&A results."
        )

    summary = {
        "source_files": len(source_index),
        "normalized_files": len(normalized_index),
        "record_nodes": len(record_nodes),
        "memory_items": len(memory_index),
        "graph_nodes": len(nodes),
        "graph_edges": len(links),
        "ambiguous_edges": len(ambiguous_edges),
        "inferred_edges": len(inferred_edges),
        "low_confidence_edges": len(low_confidence_edges),
        "unrepresented_sources": len(unrepresented_sources),
    }

    return {
        "summary": summary,
        "warnings": warnings,
        "checks": {
            "unrepresented_sources": unrepresented_sources,
            "mineru_normalized_files": mineru_normalized,
            "pdf_normalized_files": pdf_normalized,
            "low_confidence_edges": low_confidence_edges,
            "ambiguous_edges": ambiguous_edges,
            "memory_index": memory_index,
        },
    }


def render_health_markdown(report: dict[str, Any]) -> str:
    summary = report.get("summary", {})
    warnings = report.get("warnings", [])
    checks = report.get("checks", {})

    lines = [
        "# Health Report",
        "",
        "## Summary",
        f"- Source files: {summary.get('source_files', 0)}",
        f"- Normalized files: {summary.get('normalized_files', 0)}",
        f"- Graph nodes: {summary.get('graph_nodes', 0)}",
        f"- Graph edges: {summary.get('graph_edges', 0)}",
        f"- Record nodes: {summary.get('record_nodes', 0)}",
        f"- Memory artifacts: {summary.get('memory_items', 0)}",
        f"- Unrepresented sources: {summary.get('unrepresented_sources', 0)}",
        f"- Ambiguous edges: {summary.get('ambiguous_edges', 0)}",
        f"- Low-confidence edges: {summary.get('low_confidence_edges', 0)}",
        "",
        "## Warnings",
    ]

    if warnings:
        lines.extend(f"- {warning}" for warning in warnings)
    else:
        lines.append("- No high-signal health warnings.")

    unrepresented_sources = checks.get("unrepresented_sources", [])
    if unrepresented_sources:
        lines.extend(["", "## Unrepresented Sources"])
        for entry in unrepresented_sources[:20]:
            lines.append(f"- `{entry.get('source_path', '')}`")

    low_confidence_edges = checks.get("low_confidence_edges", [])
    if low_confidence_edges:
        lines.extend(["", "## Low-Confidence Edges"])
        for edge in low_confidence_edges[:20]:
            score = edge.get("confidence_score")
            lines.append(
                f"- `{edge.get('source', '')}` --{edge.get('relation', '')}--> `{edge.get('target', '')}` "
                f"(score={score})"
            )

    return "\n".join(lines) + "\n"


def write_health_assets(health_dir: Path, report: dict[str, Any]) -> dict[str, Path]:
    health_dir.mkdir(parents=True, exist_ok=True)
    json_path = health_dir / "health.json"
    md_path = health_dir / "HEALTH_REPORT.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(render_health_markdown(report), encoding="utf-8")
    return {"json": json_path, "markdown": md_path}
