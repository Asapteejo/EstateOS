export function escapeCsvValue(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }

  return raw;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");
}
