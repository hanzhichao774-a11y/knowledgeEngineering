from pathlib import Path

from graphify.normalize import convert_pdf_file


def test_convert_pdf_file_writes_page_image_section_when_textless_pages_have_images(tmp_path, monkeypatch):
    pdf_path = tmp_path / "report.pdf"
    pdf_path.write_bytes(b"%PDF-1.4 test")

    image_path = tmp_path / "converted" / "report_images" / "report_page021_img1.jpg"
    image_path.parent.mkdir(parents=True, exist_ok=True)
    image_path.write_bytes(b"\xff\xd8\xff\xd9")

    monkeypatch.setattr("graphify.normalize._run_mineru", lambda path, out_dir: None)
    monkeypatch.setattr("graphify.normalize._extract_pdf_page_texts", lambda path: ["", ""])
    monkeypatch.setattr("graphify.normalize._extract_pdf_page_images", lambda path, out_dir, page_numbers=None: [image_path])

    md_path, image_paths = convert_pdf_file(pdf_path, tmp_path / "converted")

    assert md_path is not None
    assert image_paths == [image_path]

    text = md_path.read_text(encoding="utf-8")
    assert 'normalized_from: "pdf"' in text
    assert "## Extracted Page Images" in text
    assert image_path.name in text

