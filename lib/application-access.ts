export type ApplicationAccessFacts = {
  decision: "accepted" | "rejected" | "waitlisted" | null;
  stage:
    | "draft"
    | "submitted"
    | "r1_queued"
    | "r1_done"
    | "r2_queued"
    | "r2_done"
    | "decided";
  submittedAt: Date | null;
};

/**
 * A staff-approved late applicant may finish their existing draft without
 * reopening general intake. The exception ends as soon as they submit.
 */
export function canFinishAcceptedDraft(
  row: ApplicationAccessFacts | null | undefined,
): boolean {
  return Boolean(
    row &&
      row.decision === "accepted" &&
      row.stage === "draft" &&
      row.submittedAt === null,
  );
}
