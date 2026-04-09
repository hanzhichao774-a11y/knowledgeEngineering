import json
from pathlib import Path

import networkx as nx
from networkx.readwrite import json_graph

from graphify.assets import build_knowledge_assets


def test_build_knowledge_assets_writes_expected_outputs(tmp_path: Path):
    root = tmp_path
    out = root / "graphify-out"
    converted = out / "converted"
    converted.mkdir(parents=True)

    source_pdf = root / "report.pdf"
    source_pdf.write_text("fake pdf payload", encoding="utf-8")

    sidecar = converted / "report_sidecar.md"
    sidecar.write_text(
        "---\n"
        f'original_source_file: "{source_pdf}"\n'
        'original_filename: "report.pdf"\n'
        'normalized_from: "mineru"\n'
        "---\n\n"
        "# Normalized PDF\n",
        encoding="utf-8",
    )

    G = nx.Graph()
    G.add_node(
        "record-1",
        label="海淀分公司诉求总量",
        source_file=str(source_pdf),
        source_location="p21",
        file_type="paper",
        record_key="海淀/诉求总量",
        record_json={"12345": 11, "96069及网络": 16, "小循环": 18, "微循环": 49, "合计": 94},
        community=0,
    )
    G.add_node("node-2", label="客服工单", source_file=str(source_pdf), source_location="p20", community=1)
    G.add_edge("record-1", "node-2", relation="describes", confidence="EXTRACTED")

    out.mkdir(exist_ok=True)
    (out / "graph.json").write_text(
        json.dumps(json_graph.node_link_data(G, edges="links"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out / "GRAPH_REPORT.md").write_text("# Report\n", encoding="utf-8")

    detection_result = {
        "files": {
            "paper": [str(source_pdf)],
            "document": [str(sidecar)],
        }
    }

    summary = build_knowledge_assets(root, detection_result=detection_result)

    assert summary["record_count"] == 1
    assert Path(summary["source_index"]).exists()
    assert Path(summary["normalized_index"]).exists()
    assert Path(summary["records"]).exists()
    assert Path(summary["graph"]).exists()
    assert Path(summary["report"]).exists()
    assert Path(summary["health_json"]).exists()
    assert Path(summary["health_markdown"]).exists()
    assert Path(summary["summary_path"]).exists()

    records = [json.loads(line) for line in Path(summary["records"]).read_text(encoding="utf-8").splitlines()]
    assert records[0]["label"] == "海淀分公司诉求总量"

