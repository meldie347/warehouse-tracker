import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditLogRetentionCutoff } from "@/lib/retention";

// Product/Category/Shop (the live stock catalog and shop list) are never touched
// here — only AuditLog rows expire. The Activity Log and shop report are kept
// for a month; anything older is removed automatically so storage doesn't grow
// unbounded.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed if the secret isn't configured at all, rather than matching
  // the literal string "Bearer undefined" against whatever the caller sends.
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auditResult = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: getAuditLogRetentionCutoff() } },
  });

  return NextResponse.json({ deletedAuditLogEntries: auditResult.count });
}
