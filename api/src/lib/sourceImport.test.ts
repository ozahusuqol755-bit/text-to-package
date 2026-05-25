import { describe, expect, it } from "vitest";
import {
  buildGoogleSheetCsvUrl,
  parseViralMaxingCsv,
  type ViralMaxingImportRow,
} from "./sourceImport.js";

describe("sourceImport", () => {
  it("builds a public Google Sheets CSV export URL", () => {
    expect(
      buildGoogleSheetCsvUrl(
        "https://docs.google.com/spreadsheets/d/sheet-id-123/edit?gid=987654#gid=987654",
      ),
    ).toBe("https://docs.google.com/spreadsheets/d/sheet-id-123/export?format=csv&gid=987654");
  });

  it("keeps existing CSV export URLs unchanged", () => {
    expect(
      buildGoogleSheetCsvUrl(
        "https://docs.google.com/spreadsheets/d/sheet-id-123/export?format=csv&gid=42",
      ),
    ).toBe("https://docs.google.com/spreadsheets/d/sheet-id-123/export?format=csv&gid=42");
  });

  it("keeps published Google Sheets CSV URLs unchanged", () => {
    expect(
      buildGoogleSheetCsvUrl(
        "https://docs.google.com/spreadsheets/d/e/pub-id-123/pub?gid=0&single=true&output=csv",
      ),
    ).toBe("https://docs.google.com/spreadsheets/d/e/pub-id-123/pub?gid=0&single=true&output=csv");
  });

  it("parses ViralMaxing CSV rows into source import rows", () => {
    const csv = [
      "url,platform,views,likes,comments,shares,saves,engagement_rate,author,caption,published_at,detected_at,niche/topic",
      '"https://example.com/post,with-comma",TikTok,"12 500",640,18,91,44,6.2,@viral,"Hook, then proof",2026-05-01,2026-05-02,ai marketing',
    ].join("\n");

    expect(parseViralMaxingCsv(csv)).toEqual<ViralMaxingImportRow[]>([
      {
        title: "Hook, then proof",
        url: "https://example.com/post,with-comma",
        platform: "TikTok",
        rawPayload: {
          url: "https://example.com/post,with-comma",
          platform: "TikTok",
          views: 12500,
          likes: 640,
          comments: 18,
          shares: 91,
          saves: 44,
          engagement_rate: 6.2,
          author: "@viral",
          caption: "Hook, then proof",
          published_at: "2026-05-01",
          detected_at: "2026-05-02",
          niche: "ai marketing",
        },
        tags: ["viralmaxing", "tiktok", "ai marketing"],
      },
    ]);
  });

  it("skips rows without a url", () => {
    expect(parseViralMaxingCsv("url,platform,views\n,TikTok,100")).toEqual([]);
  });
});
