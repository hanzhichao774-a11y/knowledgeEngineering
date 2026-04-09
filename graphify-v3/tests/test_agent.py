import json
from pathlib import Path

import networkx as nx
from networkx.readwrite import json_graph

from graphify.agent import answer, search_records


def _write_fixture_kb(root: Path) -> None:
    out = root / "graphify-out"
    records_dir = out / "records"
    records_dir.mkdir(parents=True)

    record = {
        "id": "record-1",
        "label": "海淀分公司诉求总量",
        "source_file": str(root / "report.pdf"),
        "source_location": "p21",
        "record_key": "海淀/诉求总量",
        "record_json": {"12345": 11, "96069及网络": 16, "小循环": 18, "微循环": 49, "合计": 94},
        "community": 0,
    }
    (records_dir / "records.jsonl").write_text(json.dumps(record, ensure_ascii=False) + "\n", encoding="utf-8")

    G = nx.Graph()
    G.add_node(
        "record-1",
        label="海淀分公司诉求总量",
        source_file=str(root / "report.pdf"),
        source_location="p21",
        community=0,
        record_key="海淀/诉求总量",
    )
    G.add_node("node-2", label="客服工单", source_file=str(root / "report.pdf"), community=1)
    G.add_edge("record-1", "node-2", relation="describes", confidence="EXTRACTED")
    out.mkdir(exist_ok=True)
    (out / "graph.json").write_text(
        json.dumps(json_graph.node_link_data(G, edges="links"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def test_search_records_matches_row_level_fact(tmp_path: Path):
    _write_fixture_kb(tmp_path)

    matches = search_records("海淀分公司 诉求总量", tmp_path, top_n=3)

    assert matches
    assert matches[0]["label"] == "海淀分公司诉求总量"
    assert matches[0]["record_json"]["合计"] == 94


def test_answer_supports_structured_and_artifact_formats(tmp_path: Path):
    _write_fixture_kb(tmp_path)

    structured = answer("海淀分公司诉求总量", tmp_path, output_format="structured")
    artifact = answer("海淀分公司诉求总量", tmp_path, output_format="artifact")

    payload = json.loads(structured)
    assert payload["records"][0]["record_json"]["合计"] == 94
    assert "# Knowledge Briefing" in artifact
    assert "海淀分公司诉求总量" in artifact

