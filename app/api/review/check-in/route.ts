import { createCheckInHandler } from "@/lib/check-in-handler";
import { verifyCheckInCode } from "@/lib/check-in-badge";
import { getAuthorizedUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { createCheckInStore } from "@/lib/db/check-in";

const store = createCheckInStore(db);

export const POST = createCheckInHandler({
  trustedOrigin: process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : undefined,
  async authorize() {
    const authz = await getAuthorizedUser("reviewer", "admin");
    if (!authz || (authz.role !== "reviewer" && authz.role !== "admin")) return null;
    return { id: authz.user.id, role: authz.role };
  },
  search: store.search,
  checkIn: store.checkIn,
  verifyCode: (code) => verifyCheckInCode(code, process.env.BETTER_AUTH_SECRET ?? ""),
});
