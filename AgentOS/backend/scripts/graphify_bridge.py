#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _resolve_graph_path(workspace: Path) -> Path | None:
    candidates = [
        workspace / "graphify-out" / "graph.json",
        workspace / "graphify-out" / "graph" / "graph.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _resolve_records_path(workspace: Path) -> Path | None:
    candidates = [
        workspace / "graphify-out" / "records" / "records.jsonl",
        workspace / "graphify-out" / "records.jsonl",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _resolve_health_path(workspace: Path) -> Path | None:
    candidates = [
        workspace / "graphify-out" / "health" / "health.json",
        workspace / "graphify-out" / "health.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _timestamp_to_iso(ts: float | None) -> str | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _freshness(updated_at: str | None) -> dict[str, Any]:
    if not updated_at:
        return {"status": "missing"}
    updated = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    age_seconds = (datetime.now(timezone.utc) - updated).total_seconds()
    return {
        "status": "stale" if age_seconds > 7 * 24 * 3600 else "fresh",
        "updatedAt": updated_at,
    }


def _snapshot_status(workspace: Path) -> dict[str, Any]:
    graph_path = _resolve_graph_path(workspace)
    record_path = _resolve_records_path(workspace)
    asset_root = workspace / "graphify-out"

    if not graph_path or not graph_path.exists():
      return {
          "ok": True,
          "exists": False,
          "snapshotId": None,
          "assetRoot": str(asset_root),
          "nodeCount": 0,
          "edgeCount": 0,
          "recordCount": 0,
          "freshness": {"status": "missing"},
      }

    graph_data = json.loads(graph_path.read_text(encoding="utf-8"))
    nodes = graph_data.get("nodes") or []
    links = graph_data.get("links") or graph_data.get("edges") or []
    updated_at = _timestamp_to_iso(graph_path.stat().st_mtime)
    snapshot_id = f"{int(graph_path.stat().st_mtime)}-{graph_path.stat().st_size}"
    record_count = 0
    if record_path and record_path.exists():
        record_count = sum(1 for line in record_path.read_text(encoding="utf-8").splitlines() if line.strip())

    return {
        "ok": True,
        "exists": True,
        "snapshotId": snapshot_id,
        "updatedAt": updated_at,
        "assetRoot": str(asset_root),
        "graphPath": str(graph_path),
        "nodeCount": len(nodes),
        "edgeCount": len(links),
        "recordCount": record_count,
        "freshness": _freshness(updated_at),
    }


def _print(payload: Any) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit("Usage: graphify_bridge.py <repo_path> <command> <payload_json>")

    repo_path = Path(sys.argv[1]).resolve()
    command = sys.argv[2]
    payload = json.loads(sys.argv[3])
    workspace = Path(payload.get("workspacePath") or repo_path).resolve()

    sys.path.insert(0, str(repo_path))

    if command == "snapshot":
        _print(_snapshot_status(workspace))
        return

    if command == "rebuild":
        from graphify.assets import build_knowledge_assets

        graph_path = _resolve_graph_path(workspace)
        if graph_path is None or not graph_path.exists():
            try:
                from graphify.watch import _rebuild_code

                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    _rebuild_code(workspace)
            except Exception:
                pass

        build_knowledge_assets(workspace)
        status = _snapshot_status(workspace)
        _print(
            {
                "ok": True,
                "snapshotId": status.get("snapshotId"),
                "assetRoot": status.get("assetRoot"),
                "graphPath": status.get("graphPath"),
                "nodeCount": status.get("nodeCount", 0),
                "edgeCount": status.get("edgeCount", 0),
                "recordCount": status.get("recordCount", 0),
                "updatedAt": status.get("updatedAt"),
            }
        )
        return

    if command == "health":
        health_path = _resolve_health_path(workspace)
        status = _snapshot_status(workspace)
        if health_path and health_path.exists():
            _print(
                {
                    "ok": True,
                    "snapshotId": status.get("snapshotId"),
                    "health": json.loads(health_path.read_text(encoding="utf-8")),
                    "healthPath": str(health_path),
                }
            )
            return

        _print(
            {
                "ok": True,
                "snapshotId": status.get("snapshotId"),
                "health": {
                    "summary": {
                        "source_files": 0,
                        "normalized_files": 0,
                        "record_nodes": 0,
                        "memory_items": 0,
                        "graph_nodes": 0,
                        "graph_edges": 0,
                        "ambiguous_edges": 0,
                        "inferred_edges": 0,
                        "low_confidence_edges": 0,
                        "unrepresented_sources": 0,
                    },
                    "warnings": [],
                    "checks": {
                        "unrepresented_sources": [],
                        "mineru_normalized_files": [],
                        "pdf_normalized_files": [],
                        "low_confidence_edges": [],
                        "ambiguous_edges": [],
                        "memory_index": [],
                    },
                },
            }
        )
        return

    if command == "search-records":
        from graphify.agent import search_records

        status = _snapshot_status(workspace)
        records = search_records(payload["query"], workspace, top_n=int(payload.get("topN") or 10))
        _print({"ok": True, "snapshotId": status.get("snapshotId"), "records": records})
        return

    if command == "ask":
        from graphify.agent import answer

        status = _snapshot_status(workspace)
        fmt = payload.get("format") or "structured"
        raw_answer = answer(
            payload["question"],
            workspace,
            output_format=fmt,
            top_n=int(payload.get("topN") or 5),
        )
        parsed_answer: Any = raw_answer
        if fmt in {"structured", "evidence"}:
            try:
                parsed_answer = json.loads(raw_answer)
            except json.JSONDecodeError:
                parsed_answer = raw_answer
        _print(
            {
                "ok": True,
                "snapshotId": status.get("snapshotId"),
                "freshness": status.get("freshness"),
                "answer": parsed_answer,
            }
        )
        return

    raise SystemExit(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
