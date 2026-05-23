import { describe, expect, it } from "vitest";
import type { ContentPack, ReviewCheck } from "@/types/pipeline";
import { canApprovePack, canPublishPack } from "./transitions";

const pack = (patch: Partial<ContentPack> = {}): ContentPack => ({
  id: "pack_1",
  idea_id: "idea_1",
  title: "Pack",
  status: "draft",
  created_at: "2026-05-23T00:00:00.000Z",
  ...patch,
});

const check = (patch: Partial<ReviewCheck> = {}): ReviewCheck => ({
  id: "rc_1",
  pack_id: "pack_1",
  label: "Required check",
  required: true,
  passed: false,
  ...patch,
});

describe("canApprovePack", () => {
  it("blocks approval when a pack has no checklist", () => {
    expect(canApprovePack([], "pack_1")).toBe(false);
  });

  it("blocks approval when a pack has no required checklist items", () => {
    expect(canApprovePack([check({ required: false, passed: true })], "pack_1")).toBe(false);
  });

  it("blocks approval until all required checklist items are passed", () => {
    expect(
      canApprovePack(
        [check({ id: "rc_1", passed: true }), check({ id: "rc_2", passed: false })],
        "pack_1",
      ),
    ).toBe(false);
  });

  it("allows approval when every required checklist item is passed", () => {
    expect(
      canApprovePack(
        [
          check({ id: "rc_1", passed: true }),
          check({ id: "rc_2", required: false, passed: false }),
        ],
        "pack_1",
      ),
    ).toBe(true);
  });
});

describe("canPublishPack", () => {
  it("blocks publishing without a pack", () => {
    expect(canPublishPack(undefined)).toBe(false);
  });

  it("blocks publishing when approved metadata is incomplete", () => {
    expect(canPublishPack(pack({ status: "approved" }))).toBe(false);
    expect(canPublishPack(pack({ status: "approved", approved_by: "@editor_kz" }))).toBe(false);
    expect(
      canPublishPack(pack({ status: "approved", approved_at: "2026-05-23T00:00:00.000Z" })),
    ).toBe(false);
  });

  it("blocks publishing when status is not approved even if metadata exists", () => {
    expect(
      canPublishPack(
        pack({
          status: "ready_for_review",
          approved_by: "@editor_kz",
          approved_at: "2026-05-23T00:00:00.000Z",
        }),
      ),
    ).toBe(false);
  });

  it("allows publishing only with approved status, approved_by, and approved_at", () => {
    expect(
      canPublishPack(
        pack({
          status: "approved",
          approved_by: "@editor_kz",
          approved_at: "2026-05-23T00:00:00.000Z",
        }),
      ),
    ).toBe(true);
  });
});
