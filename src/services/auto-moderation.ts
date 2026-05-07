import { prisma } from "../lib/prisma";

const AUTO_BAN_ENABLED = String(process.env.AUTO_BAN_ENABLED || "false").toLowerCase() === "true";
const AUTO_BAN_REPORT_THRESHOLD = Number(process.env.AUTO_BAN_REPORT_THRESHOLD || 3);
const AUTO_BAN_WINDOW_HOURS = Number(process.env.AUTO_BAN_WINDOW_HOURS || 24);

export async function evaluateAutoBanForReportedUser(reportedUserId: string): Promise<{
  autoBanned: boolean;
  uniqueReporters: number;
  threshold: number;
}> {
  if (!AUTO_BAN_ENABLED) {
    return { autoBanned: false, uniqueReporters: 0, threshold: AUTO_BAN_REPORT_THRESHOLD };
  }
  const threshold = Number.isFinite(AUTO_BAN_REPORT_THRESHOLD) ? AUTO_BAN_REPORT_THRESHOLD : 3;
  const windowHours = Number.isFinite(AUTO_BAN_WINDOW_HOURS) ? AUTO_BAN_WINDOW_HOURS : 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const reports = await prisma.report.findMany({
    where: {
      reportedId: reportedUserId,
      createdAt: { gte: since },
      status: { in: ["open", "in_review"] }
    },
    select: { reporterId: true }
  });

  const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;
  if (uniqueReporters < threshold) {
    return { autoBanned: false, uniqueReporters, threshold };
  }

  const user = await prisma.user.findUnique({
    where: { id: reportedUserId },
    select: { id: true, isBanned: true }
  });
  if (!user || user.isBanned) {
    return { autoBanned: false, uniqueReporters, threshold };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reportedUserId },
      data: {
        isBanned: true,
        banReason: `[AUTO] ${uniqueReporters} reports from unique users in ${windowHours}h`
      }
    }),
    prisma.refreshSession.updateMany({
      where: { userId: reportedUserId, revokedAt: null },
      data: { revokedAt: new Date() }
    }),
    prisma.report.updateMany({
      where: {
        reportedId: reportedUserId,
        status: "open"
      },
      data: {
        status: "in_review",
        reviewedAt: new Date()
      }
    })
  ]);

  return { autoBanned: true, uniqueReporters, threshold };
}

