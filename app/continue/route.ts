import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/dal";

/**
 * Post-sign-in fork: submitted applicants land on their dashboard, everyone
 * else lands on their in-progress application. The sign-in page points here
 * because the client can't know submission state at redirect time.
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [row] = await db
    .select({ submittedAt: application.submittedAt })
    .from(application)
    .where(eq(application.userId, user.id))
    .limit(1);

  redirect(row?.submittedAt ? "/dashboard" : "/apply");
}
