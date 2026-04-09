from graphify.health import build_health_report, render_health_markdown


def test_health_report_flags_missing_coverage_and_confidence():
    report = build_health_report(
        source_index=[
            {
                "source_path": "/tmp/source.pdf",
                "normalized_path": "/tmp/converted/source.md",
            }
        ],
        normalized_index=[
            {
                "normalized_path": "/tmp/converted/source.md",
                "normalized_from": "pdf",
            }
        ],
        memory_index=[],
        graph_data={
            "nodes": [
                {"id": "n1", "label": "客服工单", "source_file": "/tmp/other.pdf"},
            ],
            "links": [
                {
                    "source": "n1",
                    "target": "n2",
                    "relation": "related_to",
                    "confidence": "AMBIGUOUS",
                    "confidence_score": 0.2,
                }
            ],
        },
    )

    assert report["summary"]["unrepresented_sources"] == 1
    assert report["summary"]["low_confidence_edges"] == 1
    assert any("MinerU" in warning for warning in report["warnings"])
    assert any("No derived memory artifacts" in warning for warning in report["warnings"])

    markdown = render_health_markdown(report)
    assert "Unrepresented Sources" in markdown
    assert "`/tmp/source.pdf`" in markdown
