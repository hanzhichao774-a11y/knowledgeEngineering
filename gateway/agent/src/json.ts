export function extractJSON<T = unknown>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  let raw = fenceMatch ? fenceMatch[1].trim() : text.trim();

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Continue with best-effort repairs below.
  }

  raw = raw.replace(/,\s*([}\]])/g, '$1');
  raw = raw.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Continue with truncation-based repair below.
  }

  const lastBrace = raw.lastIndexOf('}');
  const lastBracket = raw.lastIndexOf(']');
  if (lastBrace > 0 || lastBracket > 0) {
    const cutoff = Math.max(lastBrace, lastBracket) + 1;
    let truncated = raw.slice(0, cutoff);

    let braces = 0;
    let brackets = 0;
    for (const ch of truncated) {
      if (ch === '{') braces += 1;
      else if (ch === '}') braces -= 1;
      else if (ch === '[') brackets += 1;
      else if (ch === ']') brackets -= 1;
    }

    while (brackets > 0) {
      truncated += ']';
      brackets -= 1;
    }
    while (braces > 0) {
      truncated += '}';
      braces -= 1;
    }

    truncated = truncated.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(truncated) as T;
  }

  throw new Error(`Failed to parse JSON from LLM response: ${raw.slice(0, 160)}...`);
}
