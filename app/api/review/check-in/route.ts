import { createCheckInHandler } from "@/lib/check-in-handler";
import { verifyBadgeCode } from "@/lib/check-in-badge";
import { getAuthorizedUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { createCheckInStore } from "@/lib/db/check-in";
import { isStaffRole, STAFF_ROLES } from "@/lib/permissions";

const store = createCheckInStore(db);

export const POST = createCheckInHandler({
  trustedOrigin: process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : undefined,
  async authorize() {
    const authz = await getAuthorizedUser(...STAFF_ROLES);
    if (!authz || !isStaffRole(authz.role)) return null;
    return { id: authz.user.id, role: authz.role };
  },
  search: store.search,
  checkIn: store.checkIn,
  checkInStaff: store.checkInStaff,
  verifyCode: (code) => verifyBadgeCode(code, process.env.BETTER_AUTH_SECRET ?? ""),
});
