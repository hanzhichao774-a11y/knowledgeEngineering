from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .detect import detect
from .health import build_health_report, write_health_assets


def _resolve_input_path(root: Path, path: Path | None, default: Path) -> Path:
    if path is None:
        return default
    return path if path.is_absolute() else (root / path)


@dataclass(frozen=True)
class AssetLayout:
    root: Path
    out: Path
    raw: Path
    normalized: Path
    records: Path
    graph: Path
    memory: Path
    reports: Path
    health: Path

    def ensure(self) -> None:
        for path in (
            self.out,
            self.raw,
            self.normalized,
            self.records,
            self.graph,
            self.memory,
            self.reports,
            self.health,
        ):
            path.mkdir(parents=True, exist_ok=True)


def get_asset_layout(root: Path) -> AssetLayout:
    root = Path(root).resolve()
    out = root / "graphify-out"
    return AssetLayout(
        root=root,
        out=out,
        raw=out / "raw",
        normalized=out / "normalized",
        records=out / "records",
        graph=out / "graph",
        memory=out / "memory",
        reports=out / "reports",
        health=out / "health",
    )


def _read_frontmatter(path: Path) -> dict[str, str]:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return {}
    if not text.startswith("---\n"):
        return {}
    lines = text.splitlines()
    result: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip('"')
    return result


def _load_graph_data(layout: AssetLayout, graph_path: Path | None = None) -> dict[str, Any]:
    path = _resolve_input_path(layout.root, graph_path, layout.out / "graph.json")
    if not path.exists():
        return {"nodes": [], "links": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _collect_source_index(layout: AssetLayout, detection_result: dict[str, Any] | None) -> list[dict[str, Any]]:
    detection_result = detection_result or detect(layout.root)
    entries: dict[str, dict[str, Any]] = {}
    for kind, files in detection_result.get("files", {}).items():
        for file_name in files:
            path = Path(file_name)
            normalized_path = str(path) if str(path).startswith(str(layout.out / "converted")) else None
            frontmatter = _read_frontmatter(path) if normalized_path else {}
            source_path = frontmatter.get("original_source_file") or file_name
            key = str(Path(source_path))
            if key in entries:
                continue
            source = Path(source_path)
            entries[key] = {
                "source_path": key,
                "detected_as": kind,
                "normalized_path": normalized_path,
                "exists": source.exists(),
                "size_bytes": source.stat().st_size if source.exists() else None,
            }
    return sorted(entries.values(), key=lambda entry: entry["source_path"])


def _write_source_index(layout: AssetLayout, source_index: list[dict[str, Any]]) -> Path:
    path = layout.raw / "source_index.json"
    path.write_text(json.dumps(source_index, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _collect_normalized_index(layout: AssetLayout) -> list[dict[str, Any]]:
    converted_dir = layout.out / "converted"
    entries: list[dict[str, Any]] = []
    if not converted_dir.exists():
        return entries
    for sidecar in sorted(converted_dir.glob("*.md")):
        frontmatter = _read_frontmatter(sidecar)
        entries.append(
            {
                "normalized_path": str(sidecar),
                "original_source_file": frontmatter.get("original_source_file"),
                "original_filename": frontmatter.get("original_filename"),
                "normalized_from": frontmatter.get("normalized_from"),
                "size_bytes": sidecar.stat().st_size,
            }
        )
    return entries


def _write_normalized_index(layout: AssetLayout, normalized_index: list[dict[str, Any]]) -> Path:
    path = layout.normalized / "normalized_index.json"
    path.write_text(json.dumps(normalized_index, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _collect_record_store(graph_data: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for node in graph_data.get("nodes", []):
        if node.get("record_json") is None:
            continue
        records.append(
            {
                "id": node.get("id"),
                "label": node.get("label"),
                "source_file": node.get("source_file"),
                "source_location": node.get("source_location"),
                "file_type": node.get("file_type"),
                "record_key": node.get("record_key"),
                "record_json": node.get("record_json"),
                "community": node.get("community"),
            }
        )
    return records


def _write_record_store(layout: AssetLayout, records: list[dict[str, Any]]) -> tuple[Path, Path]:
    jsonl_path = layout.records / "records.jsonl"
    index_path = layout.records / "index.json"

    with jsonl_path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    summary = {
        "record_count": len(records),
        "sources": sorted({record.get("source_file") for record in records if record.get("source_file")}),
    }
    index_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return jsonl_path, index_path


def _write_memory_index(layout: AssetLayout) -> Path:
    entries: list[dict[str, Any]] = []
    if layout.memory.exists():
        for path in sorted(layout.memory.glob("*.md")):
            entries.append(
                {
                    "path": str(path),
                    "size_bytes": path.stat().st_size,
                }
            )
    index_path = layout.memory / "index.json"
    index_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    return index_path


def _write_graph_assets(layout: AssetLayout, graph_data: dict[str, Any], graph_path: Path | None = None) -> tuple[Path | None, Path]:
    source = _resolve_input_path(layout.root, graph_path, layout.out / "graph.json")
    target = layout.graph / "graph.json"
    if source.exists():
        shutil.copy2(source, target)
    else:
        target.write_text(json.dumps(graph_data, ensure_ascii=False, indent=2), encoding="utf-8")

    graph_index = {
        "nodes": len(graph_data.get("nodes", [])),
        "edges": len(graph_data.get("links", [])),
        "communities": sorted({node.get("community") for node in graph_data.get("nodes", []) if node.get("community") is not None}),
    }
    index_path = layout.graph / "index.json"
    index_path.write_text(json.dumps(graph_index, ensure_ascii=False, indent=2), encoding="utf-8")
    return (target if target.exists() else None), index_path


def _write_report_assets(layout: AssetLayout, report_text: str | None, report_path: Path | None = None) -> tuple[Path | None, Path]:
    source = _resolve_input_path(layout.root, report_path, layout.out / "GRAPH_REPORT.md")
    target = layout.reports / "GRAPH_REPORT.md"
    if report_text is not None:
        target.write_text(report_text, encoding="utf-8")
    elif source.exists():
        shutil.copy2(source, target)
    index_path = layout.reports / "index.json"
    index_path.write_text(
        json.dumps({"report_path": str(target), "exists": target.exists()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return (target if target.exists() else None), index_path


def build_knowledge_assets(
    root: Path,
    *,
    detection_result: dict[str, Any] | None = None,
    graph_data: dict[str, Any] | None = None,
    report_text: str | None = None,
    graph_path: Path | None = None,
    report_path: Path | None = None,
) -> dict[str, Any]:
    layout = get_asset_layout(root)
    layout.ensure()

    source_index = _collect_source_index(layout, detection_result)
    source_index_path = _write_source_index(layout, source_index)

    normalized_index = _collect_normalized_index(layout)
    normalized_index_path = _write_normalized_index(layout, normalized_index)

    graph_data = graph_data or _load_graph_data(layout, graph_path)
    graph_copy_path, graph_index_path = _write_graph_assets(layout, graph_data, graph_path)

    records = _collect_record_store(graph_data)
    records_path, record_index_path = _write_record_store(layout, records)

    report_copy_path, report_index_path = _write_report_assets(layout, report_text, report_path)

    memory_index_path = _write_memory_index(layout)
    memory_index = json.loads(memory_index_path.read_text(encoding="utf-8"))

    health_report = build_health_report(
        source_index=source_index,
        normalized_index=normalized_index,
        memory_index=memory_index,
        graph_data=graph_data,
    )
    health_paths = write_health_assets(layout.health, health_report)

    summary = {
        "asset_root": str(layout.out),
        "source_index": str(source_index_path),
        "normalized_index": str(normalized_index_path),
        "records": str(records_path),
        "record_index": str(record_index_path),
        "graph": str(graph_copy_path) if graph_copy_path else None,
        "graph_index": str(graph_index_path),
        "report": str(report_copy_path) if report_copy_path else None,
        "report_index": str(report_index_path),
        "memory_index": str(memory_index_path),
        "health_json": str(health_paths["json"]),
        "health_markdown": str(health_paths["markdown"]),
        "record_count": len(records),
        "normalized_count": len(normalized_index),
        "source_count": len(source_index),
    }

    summary_path = layout.out / "assets.json"
    summary["summary_path"] = str(summary_path)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary
