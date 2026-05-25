export interface ViralMaxingImportRow {
  title: string;
  url: string;
  platform?: string;
  rawPayload: Record<string, unknown>;
  tags: string[];
}

const GOOGLE_SHEET_RE = /docs\.google\.com\/spreadsheets\/d\/([^/]+)/;

const HEADER_ALIASES: Record<string, string> = {
  "author/account": "author",
  account: "author",
  "caption/title": "caption",
  title: "caption",
  reposts: "shares",
  "shares/reposts": "shares",
  "niche/topic": "niche",
  topic: "niche",
};

const NUMERIC_FIELDS = new Set([
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "engagement_rate",
]);

export function buildGoogleSheetCsvUrl(input: string): string {
  const url = new URL(input);

  if (
    (url.pathname.includes("/export") && url.searchParams.get("format") === "csv") ||
    url.searchParams.get("output") === "csv"
  ) {
    return url.toString();
  }

  const match = url.href.match(GOOGLE_SHEET_RE);
  if (!match?.[1]) {
    throw new Error("Expected a Google Sheets URL.");
  }

  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${match[1]}/export`);
  exportUrl.searchParams.set("format", "csv");

  const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1];
  if (gid) {
    exportUrl.searchParams.set("gid", gid);
  }

  return exportUrl.toString();
}

export function parseViralMaxingCsv(csv: string): ViralMaxingImportRow[] {
  const rows = parseCsv(csv);
  const header = rows[0]?.map(normalizeHeader) ?? [];

  if (header.length === 0) {
    return [];
  }

  return rows.slice(1).flatMap((row) => {
    const rawPayload: Record<string, unknown> = {};

    header.forEach((key, index) => {
      if (!key) return;
      const value = row[index]?.trim() ?? "";
      if (!value) return;

      rawPayload[key] = NUMERIC_FIELDS.has(key) ? parseMetric(value) : value;
    });

    const url = readString(rawPayload.url);
    if (!url) {
      return [];
    }

    const platform = readString(rawPayload.platform);
    const caption = readString(rawPayload.caption);
    const author = readString(rawPayload.author);
    const niche = readString(rawPayload.niche);

    return [
      {
        title: caption || author || url,
        url,
        ...(platform ? { platform } : {}),
        rawPayload,
        tags: ["viralmaxing", platform, niche]
          .filter((tag): tag is string => Boolean(tag))
          .map((tag) => tag.toLowerCase()),
      },
    ];
  });
}

function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[key] ?? key;
}

function parseMetric(value: string): number | string {
  const normalized = value.replace(/\s+/g, "").replace(/,(?=\d+$)/, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}
