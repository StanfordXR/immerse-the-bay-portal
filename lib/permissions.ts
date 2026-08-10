import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Three tiers, as specified: applicant / reviewer (Stanford XR member) / admin.
 *
 * Lives in its own module because the server (`lib/auth.ts`) and the browser
 * client (`lib/auth-client.ts`) must be handed the *same* access-control
 * instance, or permission checks silently disagree between the two.
 *
 * `defaultStatements` carries the admin plugin's own `user` and `session`
 * resources (ban, impersonate, set-role, revoke sessions...). Merging them in
 * rather than inventing a parallel "account" resource means the admin
 * monitoring requirement is enforced by the plugin instead of by us.
 */
export const statement = {
  ...defaultStatements,
  application: [
    "create", // start and submit your own application
    "read_own",
    "read_all", // read others' applications — redacted for reviewers, see lib/dal.ts
    "review", // score an application
    "tag",
  ],
  decision: [
    "set", // mark accepted / waitlisted / rejected
    "release", // send the emails — irreversible, admin only
  ],
} as const;

export const ac = createAccessControl(statement);

export const applicant = ac.newRole({
  application: ["create", "read_own"],
});

export const reviewer = ac.newRole({
  application: ["create", "read_own", "read_all", "review", "tag"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  application: ["create", "read_own", "read_all", "review", "tag"],
  decision: ["set", "release"],
});

export const roles = { applicant, reviewer, admin };

export const ROLE_VALUES = ["applicant", "reviewer", "admin"] as const;
export type Role = (typeof ROLE_VALUES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLE_VALUES as readonly string[]).includes(value)
  );
}
