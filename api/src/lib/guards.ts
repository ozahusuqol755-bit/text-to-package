export interface ReviewCheckLike {
  required: boolean;
  passed: boolean;
}

export interface PublishablePackLike {
  status: string;
  approved_by?: string | null;
  approved_at?: string | Date | null;
}

export function canApprovePack(checks: ReviewCheckLike[]): boolean {
  // TODO: enforce inside the approve API transaction against review_checks.
  // Rule: approve requires at least one required checklist item and every
  // required checklist item must be passed.
  const requiredChecks = checks.filter((check) => check.required);
  return requiredChecks.length > 0 && requiredChecks.every((check) => check.passed);
}

export function canPublishPack(pack: PublishablePackLike | null | undefined): boolean {
  // TODO: enforce inside the publish API transaction before creating jobs.
  // Rule: publish requires status approved + approved_by + approved_at.
  return Boolean(pack?.status === "approved" && pack.approved_by && pack.approved_at);
}
