from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any


def _stable_out_path(path: Path, out_dir: Path, suffix: str = ".md") -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    name_hash = hashlib.sha256(str(path.resolve()).encode()).hexdigest()[:8]
    return out_dir / f"{path.stem}_{name_hash}{suffix}"


def _yaml_str(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", " ")


def _clean_cell(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def _render_markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    if not headers:
        return ""
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        padded = list(row[: len(headers)]) + [""] * max(0, len(headers) - len(row))
        lines.append("| " + " | ".join(padded[: len(headers)]) + " |")
    return "\n".join(lines)


def _render_record_bullets(records: list[dict[str, str]]) -> str:
    lines: list[str] = []
    for idx, record in enumerate(records, 1):
        key = record.get("时间") or record.get("time") or record.get("record_key") or f"row_{idx}"
        lines.append(f"### Record {idx}: {key}")
        for field, value in record.items():
            lines.append(f"- {field}: {value}")
        lines.append("")
    return "\n".join(lines).rstrip()


def _summarize_numeric_records(records: list[dict[str, str]], *, exclude: set[str] | None = None) -> list[str]:
    exclude = exclude or set()
    numeric_columns: dict[str, list[float]] = {}
    for record in records:
        for field, value in record.items():
            if field in exclude:
                continue
            try:
                numeric_columns.setdefault(field, []).append(float(value))
            except (TypeError, ValueError):
                continue

    lines: list[str] = []
    for field, values in numeric_columns.items():
        if not values:
            continue
        avg = sum(values) / len(values)
        lines.append(f"- {field}: avg={avg:.2f}, min={min(values):.2f}, max={max(values):.2f}, count={len(values)}")
    return lines


def _extract_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except Exception:
        return ""

    try:
        reader = PdfReader(str(path))
    except Exception:
        return ""

    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages)


def _extract_pdf_page_texts(path: Path) -> list[str]:
    try:
        from pypdf import PdfReader
    except Exception:
        return []

    try:
        reader = PdfReader(str(path))
    except Exception:
        return []

    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        pages.append(text.strip() if text else "")
    return pages


def _normalize_pdf_filter(filter_value: Any) -> tuple[str, ...]:
    if filter_value is None:
        return ()
    if isinstance(filter_value, (list, tuple)):
        return tuple(str(item) for item in filter_value)
    return (str(filter_value),)


def _image_suffix_for_pdf_filters(filters: tuple[str, ...]) -> str | None:
    if "/DCTDecode" in filters:
        return ".jpg"
    if "/JPXDecode" in filters:
        return ".jp2"
    if "/CCITTFaxDecode" in filters:
        return ".tiff"
    if "/FlateDecode" in filters:
        return ".png"
    return None


def _extract_pdf_page_images(path: Path, out_dir: Path, page_numbers: set[int] | None = None) -> list[Path]:
    try:
        from pypdf import PdfReader
    except Exception:
        return []

    try:
        reader = PdfReader(str(path))
    except Exception:
        return []

    name_hash = hashlib.sha256(str(path.resolve()).encode()).hexdigest()[:8]
    image_dir = out_dir / f"{path.stem}_{name_hash}_images"
    image_dir.mkdir(parents=True, exist_ok=True)

    extracted: list[Path] = []
    seen_names: set[str] = set()

    for page_idx, page in enumerate(reader.pages, start=1):
        if page_numbers is not None and page_idx not in page_numbers:
            continue

        resources = page.get("/Resources")
        if not resources or "/XObject" not in resources:
            continue

        try:
            xobjects = resources["/XObject"].get_object()
        except Exception:
            continue

        image_num = 0
        for _, ref in xobjects.items():
            try:
                image_obj = ref.get_object()
            except Exception:
                continue
            if str(image_obj.get("/Subtype")) != "/Image":
                continue

            filters = _normalize_pdf_filter(image_obj.get("/Filter"))
            suffix = _image_suffix_for_pdf_filters(filters)
            if not suffix:
                continue

            raw_bytes = getattr(image_obj, "_data", None)
            if not raw_bytes:
                try:
                    raw_bytes = image_obj.get_data()
                except Exception:
                    continue
            if not raw_bytes:
                continue

            image_num += 1
            filename = f"{path.stem}_{name_hash}_page{page_idx:03d}_img{image_num}{suffix}"
            if filename in seen_names:
                continue
            seen_names.add(filename)
            out_path = image_dir / filename
            out_path.write_bytes(raw_bytes)
            extracted.append(out_path)

    return extracted


def _looks_like_numeric_row(line: str) -> bool:
    if not re.match(r"^\d{2}:\d{2}", line):
        return False
    nums = re.findall(r"-?\d+(?:\.\d+)?", line[5:])
    return len(nums) >= 4


def _guess_headers_for_numeric_row(text: str, value_count: int) -> list[str]:
    if "回水" in text and "系统效率" in text and value_count == 9:
        return [
            "热负荷(MW)",
            "供水温度(℃)",
            "回水温度(℃)",
            "供水压力(MPa)",
            "回水压力(MPa)",
            "循环流量(t/h)",
            "耗气量(Nm³)",
            "耗电量(kWh)",
            "系统效率(%)",
        ]
    return [f"metric_{i + 1}" for i in range(value_count)]


def _extract_time_series_records(text: str) -> tuple[list[str], list[dict[str, str]]]:
    rows = [line.strip() for line in text.splitlines() if line.strip()]
    records: list[dict[str, str]] = []
    headers: list[str] = []

    for row in rows:
        if not _looks_like_numeric_row(row):
            continue
        time_token = row[:5]
        values = re.findall(r"-?\d+(?:\.\d+)?", row[5:])
        if not values:
            continue
        if not headers:
            headers = _guess_headers_for_numeric_row(text, len(values))
        record = {"时间": time_token}
        for header, value in zip(headers, values):
            record[header] = value
        record["row_raw"] = row
        records.append(record)

    return headers, records


def _extract_numbered_summaries(text: str) -> list[tuple[str, str]]:
    summaries: list[tuple[str, str]] = []
    for line in text.splitlines():
        line = line.strip()
        match = re.match(r"^\d+\.\s*([^：:]+)[：:]\s*(.+)$", line)
        if match:
            summaries.append((match.group(1).strip(), match.group(2).strip()))
    return summaries


def _find_mineru_cli() -> str | None:
    for candidate in ("mineru",):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def _run_mineru(path: Path, out_dir: Path) -> dict[str, Path] | None:
    mineru = _find_mineru_cli()
    if not mineru:
        return None

    work_dir = out_dir / f"{path.stem}_{hashlib.sha256(str(path.resolve()).encode()).hexdigest()[:8]}_mineru"
    work_dir.mkdir(parents=True, exist_ok=True)

    existing_full = next(work_dir.rglob("full.md"), None)
    existing_content = next(work_dir.rglob("content_list.json"), None)
    existing_middle = next(work_dir.rglob("middle.json"), None)
    if existing_full or existing_content or existing_middle:
        return {
            "work_dir": work_dir,
            "full_md": existing_full,
            "content_list": existing_content,
            "middle_json": existing_middle,
        }

    try:
        completed = subprocess.run(
            [mineru, "-p", str(path), "-o", str(work_dir)],
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    if completed.returncode != 0:
        return None

    return {
        "work_dir": work_dir,
        "full_md": next(work_dir.rglob("full.md"), None),
        "content_list": next(work_dir.rglob("content_list.json"), None),
        "middle_json": next(work_dir.rglob("middle.json"), None),
    }


def _read_utf8(path: Path | None) -> str:
    if not path or not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _render_mineru_content_list(path: Path | None) -> str:
    if not path or not path.exists():
        return ""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ""

    if not isinstance(payload, list):
        return json.dumps(payload, ensure_ascii=False, indent=2)

    lines: list[str] = []
    for idx, item in enumerate(payload, 1):
        if not isinstance(item, dict):
            lines.append(f"### Block {idx}")
            lines.append(str(item))
            lines.append("")
            continue
        block_type = item.get("type") or item.get("category_type") or item.get("block_type") or "block"
        page_idx = item.get("page_idx") or item.get("page_no") or item.get("page") or "unknown"
        bbox = item.get("bbox") or item.get("poly") or item.get("position")
        content = ""
        for key in ("text", "content", "markdown", "md", "html", "latex", "caption", "table_caption"):
            value = item.get(key)
            if value:
                content = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
                break
        if not content:
            content = json.dumps(item, ensure_ascii=False, indent=2)
        lines.append(f"### Block {idx}: {block_type}")
        lines.append(f"- page_idx: {page_idx}")
        if bbox:
            lines.append(f"- bbox: {bbox}")
        lines.append("")
        lines.append(str(content).strip())
        lines.append("")
    return "\n".join(lines).rstrip()


def convert_pdf_file(path: Path, out_dir: Path) -> tuple[Path | None, list[Path]]:
    mineru_result = _run_mineru(path, out_dir)
    if mineru_result:
        full_markdown = _read_utf8(mineru_result.get("full_md"))
        content_list_text = _render_mineru_content_list(mineru_result.get("content_list"))
        middle_json_text = _read_utf8(mineru_result.get("middle_json"))
        combined_text = "\n\n".join(part for part in (full_markdown, content_list_text) if part.strip())
        if combined_text.strip():
            headers, records = _extract_time_series_records(combined_text)
            summaries = _extract_numbered_summaries(combined_text)
            out_path = _stable_out_path(path, out_dir)
            parts = [
                "---",
                f'original_source_file: "{_yaml_str(str(path))}"',
                f'original_filename: "{_yaml_str(path.name)}"',
                'normalized_from: "mineru"',
                f'mineru_output_dir: "{_yaml_str(str(mineru_result["work_dir"]))}"',
                "---",
                "",
                f"# Normalized PDF: {path.name}",
                "",
                "## MinerU Full Markdown",
                "",
                full_markdown.strip(),
            ]

            if content_list_text:
                parts.extend(["", "## MinerU Content List", "", content_list_text])
            if middle_json_text:
                parts.extend(["", "## MinerU Intermediate JSON", "", "```json", middle_json_text.strip(), "```"])
            if records:
                parts.extend(
                    [
                        "",
                        "## Structured Time-Series Records",
                        "",
                        _render_markdown_table(
                            ["时间"] + headers,
                            [[r.get("时间", "")] + [r.get(h, "") for h in headers] for r in records],
                        ),
                        "",
                        "## Record Details",
                        "",
                        _render_record_bullets(records),
                    ]
                )
                numeric_summary = _summarize_numeric_records(records, exclude={"时间", "row_raw"})
                if numeric_summary:
                    parts.extend(["", "## Derived Numeric Summaries", ""] + numeric_summary)

            if summaries:
                parts.extend(["", "## Numbered Summary Items", ""])
                for key, value in summaries:
                    parts.append(f"- {key}: {value}")

            out_path.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")
            return out_path, []

    page_texts = _extract_pdf_page_texts(path)
    text = "\n".join(page for page in page_texts if page)
    textless_pages = {idx for idx, page_text in enumerate(page_texts, start=1) if not page_text.strip()}
    page_images = _extract_pdf_page_images(path, out_dir, page_numbers=textless_pages or None)

    if not text.strip() and not page_images:
        return None, []

    headers, records = _extract_time_series_records(text)
    summaries = _extract_numbered_summaries(text)
    out_path = _stable_out_path(path, out_dir)

    parts = [
        "---",
        f'original_source_file: "{_yaml_str(str(path))}"',
        f'original_filename: "{_yaml_str(path.name)}"',
        'normalized_from: "pdf"',
        "---",
        "",
        f"# Normalized PDF: {path.name}",
        "",
        "## Raw Extracted Text",
        "",
        text.strip(),
    ]

    if records:
        parts.extend(
            [
                "",
                "## Structured Time-Series Records",
                "",
                _render_markdown_table(["时间"] + headers, [[r.get("时间", "")] + [r.get(h, "") for h in headers] for r in records]),
                "",
                "## Record Details",
                "",
                _render_record_bullets(records),
            ]
        )
        numeric_summary = _summarize_numeric_records(records, exclude={"时间", "row_raw"})
        if numeric_summary:
            parts.extend(["", "## Derived Numeric Summaries", ""] + numeric_summary)

    if summaries:
        parts.extend(["", "## Numbered Summary Items", ""])
        for key, value in summaries:
            parts.append(f"- {key}: {value}")

    if page_images:
        parts.extend(["", "## Extracted Page Images", ""])
        for image_path in page_images:
            match = re.search(r"_page(\d+)_img(\d+)", image_path.stem)
            if match:
                page_no = int(match.group(1))
                image_no = int(match.group(2))
                parts.append(f"- page {page_no}: image {image_no} -> {image_path.name}")
            else:
                parts.append(f"- {image_path.name}")

    out_path.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")
    return out_path, page_images


def convert_delimited_file(path: Path, out_dir: Path, delimiter: str = ",") -> Path | None:
    rows: list[list[str]] = []
    try:
        with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
            reader = csv.reader(handle, delimiter=delimiter)
            for row in reader:
                cleaned = [_clean_cell(cell) for cell in row]
                if any(cleaned):
                    rows.append(cleaned)
    except Exception:
        return None

    if not rows:
        return None

    headers = rows[0]
    data_rows = rows[1:] if len(rows) > 1 else []
    records = [{headers[i] or f"column_{i + 1}": row[i] if i < len(row) else "" for i in range(len(headers))} for row in data_rows]
    out_path = _stable_out_path(path, out_dir)

    parts = [
        "---",
        f'original_source_file: "{_yaml_str(str(path))}"',
        f'original_filename: "{_yaml_str(path.name)}"',
        'normalized_from: "delimited_text"',
        "---",
        "",
        f"# Normalized Table: {path.name}",
        "",
        "## Table",
        "",
        _render_markdown_table(headers, data_rows),
    ]

    if records:
        parts.extend(["", "## Record Details", "", _render_record_bullets(records)])
        numeric_summary = _summarize_numeric_records(records)
        if numeric_summary:
            parts.extend(["", "## Derived Numeric Summaries", ""] + numeric_summary)

    out_path.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")
    return out_path


def convert_structured_text_file(path: Path, out_dir: Path) -> Path | None:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None

    headers, records = _extract_time_series_records(text)
    if not records:
        return None

    out_path = _stable_out_path(path, out_dir)
    parts = [
        "---",
        f'original_source_file: "{_yaml_str(str(path))}"',
        f'original_filename: "{_yaml_str(path.name)}"',
        'normalized_from: "structured_text"',
        "---",
        "",
        f"# Normalized Text: {path.name}",
        "",
        "## Raw Text",
        "",
        text.strip(),
        "",
        "## Structured Records",
        "",
        _render_markdown_table(["时间"] + headers, [[r.get("时间", "")] + [r.get(h, "") for h in headers] for r in records]),
        "",
        "## Record Details",
        "",
        _render_record_bullets(records),
    ]
    numeric_summary = _summarize_numeric_records(records, exclude={"时间", "row_raw"})
    if numeric_summary:
        parts.extend(["", "## Derived Numeric Summaries", ""] + numeric_summary)
    out_path.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")
    return out_path
