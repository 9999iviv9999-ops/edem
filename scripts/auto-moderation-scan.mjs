#!/usr/bin/env node
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const autoBanEnabled = String(process.env.AUTO_BAN_ENABLED || "false").toLowerCase() === "true";
const threshold = Number(process.env.AUTO_BAN_REPORT_THRESHOLD || 3);
const windowHours = Number(process.env.AUTO_BAN_WINDOW_HOURS || 24);

async function main() {
  if (!autoBanEnabled) {
    console.log("[auto-moderation] skipped: AUTO_BAN_ENABLED is false");
    return;
  }
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const reports = await prisma.report.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: ["open", "in_review"] }
    },
    select: { reportedId: true, reporterId: true }
  });

  const grouped = new Map();
  for (const row of reports) {
    if (!grouped.has(row.reportedId)) grouped.set(row.reportedId, new Set());
    grouped.get(row.reportedId).add(row.reporterId);
  }

  let bannedCount = 0;
  for (const [reportedId, reporterSet] of grouped.entries()) {
    const uniqueReporters = reporterSet.size;
    if (uniqueReporters < threshold) continue;

    const user = await prisma.user.findUnique({
      where: { id: reportedId },
      select: { id: true, isBanned: true }
    });
    if (!user || user.isBanned) continue;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reportedId },
        data: {
          isBanned: true,
          banReason: `[AUTO] ${uniqueReporters} reports from unique users in ${windowHours}h`
        }
      }),
      prisma.refreshSession.updateMany({
        where: { userId: reportedId, revokedAt: null },
        data: { revokedAt: new Date() }
      }),
      prisma.report.updateMany({
        where: { reportedId, status: "open" },
        data: { status: "in_review", reviewedAt: new Date() }
      })
    ]);
    bannedCount += 1;
  }

  console.log(
    `[auto-moderation] done: checked=${grouped.size} users, autoBanned=${bannedCount}, threshold=${threshold}, windowHours=${windowHours}`
  );
}

main()
  .catch((err) => {
    console.error(`[auto-moderation] fail: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

