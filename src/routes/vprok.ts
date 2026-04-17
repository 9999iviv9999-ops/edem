import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { env } from "../lib/env";
import { computeVprokSettlement } from "../lib/vprok-settlement";

export const vprokRouter = Router();

const BUYER_ANTIFRAUD = {
  newAccountDays: 14,
  newAccountMaxOrderCents: 50_000,
  newAccountMaxDailyCents: 120_000,
  newAccountMaxOrdersPerDay: 3,
  orderCooldownMs: 30_000
} as const;

const createCompanySchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(1200).optional(),
  legalName: z.string().max(300).optional(),
  disputeEmail: z.string().email().optional(),
  termsUrl: z.string().url().optional(),
  returnPolicyText: z.string().max(5000).optional()
});

const createProductSchema = z.object({
  title: z.string().min(2).max(240),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().max(2000).optional(),
  unit: z.string().min(1).max(40),
  sku: z.string().max(80).optional(),
  priceCents: z.number().int().positive(),
  minShelfLifeDays: z.number().int().min(1).max(3650),
  substitutionPolicy: z.string().max(1000).optional(),
  isActive: z.boolean().optional()
});

const createOrderSchema = z.object({
  companyId: z.string().min(1),
  pickupDeadline: z.string().datetime().optional(),
  acceptSellerTerms: z.literal(true),
  acceptPlatformTerms: z.literal(true),
  platformTermsVersion: z.string().min(1).max(64),
  sellerTermsVersion: z.string().min(1).max(64).default("v1"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(1000)
      })
    )
    .min(1)
});

async function requireCompanyAccess(userId: string, companyId: string) {
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } }
  });
  return membership;
}

function requireModerationKey(headerValue?: string): boolean {
  return headerValue === env.ADMIN_MODERATION_KEY;
}

function signWebhookPayload(payload: unknown): string {
  return crypto
    .createHmac("sha256", env.VPROK_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
}

function getConfiguredPaymentProvider(requested?: string): string {
  const configured = (env.VPROK_PAYMENT_PROVIDER || "mock").toLowerCase();
  return (requested || configured).toLowerCase();
}

function settlementPayload(order: {
  totalCents: number;
  platformFeeBps: number;
  platformFeeCents: number;
  retailerPayoutCents: number;
}) {
  return {
    grossCents: order.totalCents,
    platformFeeBps: order.platformFeeBps,
    platformFeeCents: order.platformFeeCents,
    retailerPayoutCents: order.retailerPayoutCents
  };
}

vprokRouter.get("/settings/public", (_req, res) => {
  return res.json({
    platformFeeBps: env.VPROK_PLATFORM_FEE_BPS,
    /** Доля для UI, например 3 при bps=300 */
    platformFeePercent: env.VPROK_PLATFORM_FEE_BPS / 100
  });
});

type RiskViolation = {
  code: string;
  error: string;
  details?: Record<string, unknown>;
};

async function logRiskEvent(params: {
  userId: string;
  orderId?: string;
  scope: "order_create" | "order_pay";
  violation: RiskViolation;
  ipAddress?: string;
  userAgent?: string;
}) {
  await prisma.vprokRiskEvent.create({
    data: {
      userId: params.userId,
      orderId: params.orderId || null,
      scope: params.scope,
      code: params.violation.code,
      details: params.violation.details ? JSON.stringify(params.violation.details) : null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null
    }
  });
}

async function evaluateBuyerRisk(userId: string, orderTotalCents: number): Promise<RiskViolation | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true }
  });
  if (!user) return { code: "USER_NOT_FOUND", error: "User not found" };

  const now = Date.now();
  const accountAgeMs = now - user.createdAt.getTime();
  const newAccountWindowMs = BUYER_ANTIFRAUD.newAccountDays * 24 * 60 * 60 * 1000;
  const isNewAccount = accountAgeMs < newAccountWindowMs;

  if (isNewAccount && orderTotalCents > BUYER_ANTIFRAUD.newAccountMaxOrderCents) {
    return {
      code: "RISK_ORDER_LIMIT_EXCEEDED",
      error: "New account order amount exceeds risk limit",
      details: { maxOrderCents: BUYER_ANTIFRAUD.newAccountMaxOrderCents }
    };
  }

  if (!isNewAccount) return null;

  const dayStart = new Date(now - 24 * 60 * 60 * 1000);

  const [dailyAgg, recentPaidOrder] = await Promise.all([
    prisma.vprokOrder.aggregate({
      where: {
        userId,
        createdAt: { gte: dayStart },
        status: { in: ["paid", "refunded", "fulfilled"] }
      },
      _sum: { totalCents: true },
      _count: { _all: true }
    }),
    prisma.vprokOrder.findFirst({
      where: { userId, status: "paid" },
      orderBy: { paidAt: "desc" },
      select: { paidAt: true, createdAt: true }
    })
  ]);

  const dailyCount = dailyAgg._count._all || 0;
  const dailySum = dailyAgg._sum.totalCents || 0;

  if (dailyCount >= BUYER_ANTIFRAUD.newAccountMaxOrdersPerDay) {
    return {
      code: "RISK_DAILY_COUNT_LIMIT",
      error: "New account daily order count limit reached",
      details: { maxOrdersPerDay: BUYER_ANTIFRAUD.newAccountMaxOrdersPerDay }
    };
  }

  if (dailySum + orderTotalCents > BUYER_ANTIFRAUD.newAccountMaxDailyCents) {
    return {
      code: "RISK_DAILY_SUM_LIMIT",
      error: "New account daily amount limit reached",
      details: { maxDailyCents: BUYER_ANTIFRAUD.newAccountMaxDailyCents }
    };
  }

  const lastPaidTs = recentPaidOrder?.paidAt?.getTime() || recentPaidOrder?.createdAt.getTime() || 0;
  if (lastPaidTs && now - lastPaidTs < BUYER_ANTIFRAUD.orderCooldownMs) {
    return {
      code: "RISK_PAYMENT_COOLDOWN",
      error: "Too many payment attempts in short period",
      details: { cooldownMs: BUYER_ANTIFRAUD.orderCooldownMs }
    };
  }

  return null;
}

vprokRouter.post("/companies", requireAuth, async (req, res, next) => {
  try {
    const data = createCompanySchema.parse(req.body);
    const company = await prisma.company.create({
      data: {
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description?.trim() || null,
        legalName: data.legalName?.trim() || null,
        disputeEmail: data.disputeEmail?.trim() || null,
        termsUrl: data.termsUrl?.trim() || null,
        returnPolicyText: data.returnPolicyText?.trim() || null,
        members: {
          create: {
            userId: req.userId!,
            role: "owner"
          }
        }
      }
    });
    return res.status(201).json(company);
  } catch (err) {
    return next(err);
  }
});

const updateCompanyPolicySchema = z.object({
  legalName: z.string().max(300).optional(),
  disputeEmail: z.string().email().optional(),
  termsUrl: z.string().url().optional(),
  returnPolicyText: z.string().max(5000).optional(),
  isActive: z.boolean().optional()
});

vprokRouter.patch("/companies/:companyId/policy", requireAuth, async (req, res, next) => {
  try {
    const membership = await requireCompanyAccess(req.userId!, req.params.companyId);
    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this company" });
    }
    const data = updateCompanyPolicySchema.parse(req.body);
    const company = await prisma.company.update({
      where: { id: req.params.companyId },
      data: {
        legalName: data.legalName?.trim(),
        disputeEmail: data.disputeEmail?.trim(),
        termsUrl: data.termsUrl?.trim(),
        returnPolicyText: data.returnPolicyText?.trim(),
        isActive: data.isActive
      }
    });
    return res.json(company);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.patch("/admin/companies/:companyId/verify", async (req, res, next) => {
  try {
    if (!requireModerationKey(req.header("x-moderation-key"))) {
      return res.status(401).json({ error: "Invalid moderation key" });
    }

    const body = z
      .object({
        isVerified: z.boolean(),
        isActive: z.boolean().optional()
      })
      .parse(req.body);

    const updated = await prisma.company.update({
      where: { id: req.params.companyId },
      data: {
        isVerified: body.isVerified,
        ...(body.isActive === undefined ? {} : { isActive: body.isActive })
      }
    });

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.get("/admin/companies", async (req, res, next) => {
  try {
    if (!requireModerationKey(req.header("x-moderation-key"))) {
      return res.status(401).json({ error: "Invalid moderation key" });
    }

    const query = z
      .object({
        status: z.enum(["all", "verified", "unverified"]).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional()
      })
      .parse(req.query);

    const where =
      query.status === "verified"
        ? { isVerified: true }
        : query.status === "unverified"
          ? { isVerified: false }
          : {};

    const rows = await prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 100
    });

    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.get("/companies/my", requireAuth, async (req, res, next) => {
  try {
    const list = await prisma.companyMember.findMany({
      where: { userId: req.userId! },
      include: { company: true },
      orderBy: { createdAt: "desc" }
    });
    return res.json(list.map((row) => ({ role: row.role, company: row.company })));
  } catch (err) {
    return next(err);
  }
});

vprokRouter.post("/companies/:companyId/products", requireAuth, async (req, res, next) => {
  try {
    const membership = await requireCompanyAccess(req.userId!, req.params.companyId);
    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this company" });
    }

    const data = createProductSchema.parse(req.body);
    const product = await prisma.vprokProduct.create({
      data: {
        companyId: req.params.companyId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        imageUrl: data.imageUrl?.trim() || null,
        unit: data.unit.trim(),
        sku: data.sku?.trim() || null,
        priceCents: data.priceCents,
        minShelfLifeDays: data.minShelfLifeDays,
        substitutionPolicy: data.substitutionPolicy?.trim() || null,
        isActive: data.isActive ?? true
      }
    });

    return res.status(201).json(product);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.get("/catalog", async (req, res, next) => {
  try {
    const query = z
      .object({
        companyId: z.string().optional(),
        q: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional()
      })
      .parse(req.query);

    const products = await prisma.vprokProduct.findMany({
      where: {
        isActive: true,
        company: { isActive: true, isVerified: true },
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q } },
                { description: { contains: query.q } }
              ]
            }
          : {})
      },
      include: {
        company: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: query.limit ?? 50
    });

    return res.json(products);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.post("/orders", requireAuth, async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company || !company.isActive) {
      return res.status(404).json({ error: "Company not found or inactive" });
    }
    if (!company.isVerified) {
      return res.status(400).json({ error: "Company is not verified yet" });
    }
    if (!company.disputeEmail || (!company.termsUrl && !company.returnPolicyText)) {
      return res.status(400).json({
        error: "Company policy is incomplete. Seller must provide dispute contact and terms."
      });
    }
    const products = await prisma.vprokProduct.findMany({
      where: {
        id: { in: data.items.map((it) => it.productId) },
        isActive: true
      }
    });

    if (products.length !== data.items.length) {
      return res.status(400).json({ error: "One or more products are unavailable" });
    }
    const wrongCompany = products.some((p) => p.companyId !== data.companyId);
    if (wrongCompany) {
      return res.status(400).json({ error: "All products in order must belong to one company" });
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    const lineItems = data.items.map((item) => {
      const p = byId.get(item.productId)!;
      const subtotal = p.priceCents * item.quantity;
      return {
        productId: p.id,
        titleSnapshot: p.title,
        unitSnapshot: p.unit,
        quantity: item.quantity,
        unitPriceCents: p.priceCents,
        subtotalCents: subtotal
      };
    });
    const totalCents = lineItems.reduce((sum, i) => sum + i.subtotalCents, 0);
    const settlement = computeVprokSettlement(totalCents, env.VPROK_PLATFORM_FEE_BPS);
    const riskViolation = await evaluateBuyerRisk(req.userId!, totalCents);
    if (riskViolation) {
      await logRiskEvent({
        userId: req.userId!,
        scope: "order_create",
        violation: riskViolation,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      return res.status(429).json(riskViolation);
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.vprokOrder.create({
        data: {
          userId: req.userId!,
          companyId: data.companyId,
          totalCents,
          platformFeeBps: settlement.platformFeeBps,
          platformFeeCents: settlement.platformFeeCents,
          retailerPayoutCents: settlement.retailerPayoutCents,
          pickupDeadline: data.pickupDeadline ? new Date(data.pickupDeadline) : null,
          sellerTermsSnapshot: JSON.stringify({
            acceptedAt: new Date().toISOString(),
            companyId: company.id,
            companyName: company.name,
            legalName: company.legalName,
            disputeEmail: company.disputeEmail,
            termsUrl: company.termsUrl,
            returnPolicyText: company.returnPolicyText,
            sellerTermsVersion: data.sellerTermsVersion
          }),
          items: { create: lineItems }
        },
        include: { items: true }
      });

      await tx.vprokTermsAcceptance.createMany({
        data: [
          {
            userId: req.userId!,
            orderId: created.id,
            termsType: "platform",
            termsVersion: data.platformTermsVersion,
            ipAddress: req.ip || null,
            userAgent: req.header("user-agent") || null
          },
          {
            userId: req.userId!,
            orderId: created.id,
            termsType: "seller",
            termsVersion: data.sellerTermsVersion,
            ipAddress: req.ip || null,
            userAgent: req.header("user-agent") || null
          }
        ]
      });

      return created;
    });

    return res.status(201).json(order);
  } catch (err) {
    return next(err);
  }
});

const payOrderSchema = z.object({
  provider: z.string().min(2).max(40).optional(),
  providerPaymentId: z.string().max(120).optional()
});

vprokRouter.post("/orders/:orderId/pay", requireAuth, async (req, res, next) => {
  try {
    const data = payOrderSchema.parse(req.body);
    const order = await prisma.vprokOrder.findUnique({
      where: { id: req.params.orderId }
    });

    if (!order || order.userId !== req.userId) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.status !== "pending_payment") {
      return res.status(409).json({ error: "Order is already processed" });
    }
    const riskViolation = await evaluateBuyerRisk(req.userId!, order.totalCents);
    if (riskViolation) {
      await logRiskEvent({
        userId: req.userId!,
        orderId: order.id,
        scope: "order_pay",
        violation: riskViolation,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      return res.status(429).json(riskViolation);
    }
    const provider = getConfiguredPaymentProvider(data.provider);

    if (provider === "mock") {
      const [updatedOrder] = await prisma.$transaction([
        prisma.vprokOrder.update({
          where: { id: order.id },
          data: {
            status: "paid",
            paidAt: new Date()
          }
        }),
        prisma.vprokPayment.create({
          data: {
            orderId: order.id,
            provider,
            providerPaymentId: data.providerPaymentId || null,
            status: "succeeded",
            amountCents: order.totalCents
          }
        })
      ]);

      return res.json({
        mode: "mock",
        status: "paid",
        order: updatedOrder,
        settlement: settlementPayload(updatedOrder)
      });
    }

    const pendingPayment = await prisma.vprokPayment.create({
      data: {
        orderId: order.id,
        provider,
        providerPaymentId: data.providerPaymentId || null,
        status: "pending",
        amountCents: order.totalCents
      }
    });

    return res.json({
      mode: "external",
      status: "pending",
      message:
        "External provider flow is enabled. Complete payment in provider and send webhook to finalize order.",
      paymentId: pendingPayment.id,
      settlement: settlementPayload(order),
      /** Для сплита у провайдера: зарезервировано под интеграцию (YooKassa / др.) */
      splitHint: {
        platformFeeCents: order.platformFeeCents,
        retailerPayoutCents: order.retailerPayoutCents
      }
    });
  } catch (err) {
    return next(err);
  }
});

const paymentWebhookSchema = z.object({
  eventId: z.string().min(6),
  provider: z.string().min(2).max(40),
  orderId: z.string().min(1),
  providerPaymentId: z.string().max(120).optional(),
  status: z.enum(["succeeded", "failed", "refunded"]),
  amountCents: z.number().int().nonnegative()
});

vprokRouter.post("/payments/webhook", async (req, res, next) => {
  try {
    const signature = req.header("x-vprok-signature");
    const expected = signWebhookPayload(req.body);
    if (!signature || signature !== expected) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const data = paymentWebhookSchema.parse(req.body);
    const alreadyHandled = await prisma.vprokPaymentEvent.findUnique({
      where: { externalEventId: data.eventId }
    });
    if (alreadyHandled) {
      return res.json({ ok: true, duplicate: true });
    }

    const orderForWebhook = await prisma.vprokOrder.findUnique({ where: { id: data.orderId } });
    if (!orderForWebhook) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (data.amountCents !== orderForWebhook.totalCents) {
      return res.status(400).json({ error: "Webhook amount does not match order total" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.vprokOrder.findUnique({ where: { id: data.orderId } });
      if (!order) {
        throw new Error("Order not found");
      }

      let payment = await tx.vprokPayment.findFirst({
        where: {
          orderId: data.orderId,
          provider: data.provider,
          ...(data.providerPaymentId ? { providerPaymentId: data.providerPaymentId } : {})
        },
        orderBy: { createdAt: "desc" }
      });

      if (!payment) {
        payment = await tx.vprokPayment.create({
          data: {
            orderId: data.orderId,
            provider: data.provider,
            providerPaymentId: data.providerPaymentId || null,
            amountCents: data.amountCents,
            status: "pending"
          }
        });
      }

      let nextOrderStatus = order.status;
      let paidAt = order.paidAt;
      if (data.status === "succeeded") {
        nextOrderStatus = "paid";
        paidAt = order.paidAt || new Date();
      } else if (data.status === "refunded") {
        nextOrderStatus = "refunded";
      }

      const updatedPayment = await tx.vprokPayment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: data.providerPaymentId || payment.providerPaymentId,
          amountCents: data.amountCents,
          status: data.status
        }
      });

      const updatedOrder = await tx.vprokOrder.update({
        where: { id: order.id },
        data: {
          status: nextOrderStatus,
          paidAt
        }
      });

      await tx.vprokPaymentEvent.create({
        data: {
          externalEventId: data.eventId,
          paymentId: updatedPayment.id,
          orderId: order.id,
          provider: data.provider,
          status: data.status,
          amountCents: data.amountCents,
          payload: JSON.stringify(req.body)
        }
      });

      return { order: updatedOrder, payment: updatedPayment };
    });

    return res.json({ ok: true, orderStatus: result.order.status, paymentStatus: result.payment.status });
  } catch (err) {
    return next(err);
  }
});

vprokRouter.get("/orders/my", requireAuth, async (req, res, next) => {
  try {
    const orders = await prisma.vprokOrder.findMany({
      where: { userId: req.userId! },
      include: {
        items: true,
        company: { select: { id: true, name: true, slug: true } },
        payments: true
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json(orders);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.post("/orders/:orderId/refund", requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.vprokOrder.findUnique({
      where: { id: req.params.orderId }
    });
    if (!order || order.userId !== req.userId) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.status !== "paid") {
      return res.status(409).json({ error: "Only paid orders can be refunded" });
    }

    const [updatedOrder] = await prisma.$transaction([
      prisma.vprokOrder.update({
        where: { id: order.id },
        data: { status: "refunded" }
      }),
      prisma.vprokPayment.create({
        data: {
          orderId: order.id,
          provider: "mock",
          status: "refunded",
          amountCents: order.totalCents
        }
      })
    ]);

    return res.json(updatedOrder);
  } catch (err) {
    return next(err);
  }
});

const createDisputeSchema = z.object({
  buyerMessage: z.string().min(5).max(4000)
});

vprokRouter.post("/orders/:orderId/disputes", requireAuth, async (req, res, next) => {
  try {
    const body = createDisputeSchema.parse(req.body);
    const order = await prisma.vprokOrder.findUnique({
      where: { id: req.params.orderId }
    });
    if (!order || order.userId !== req.userId) {
      return res.status(404).json({ error: "Order not found" });
    }

    const dispute = await prisma.vprokDispute.create({
      data: {
        orderId: order.id,
        userId: req.userId!,
        companyId: order.companyId,
        buyerMessage: body.buyerMessage.trim()
      }
    });
    return res.status(201).json(dispute);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.get("/companies/:companyId/disputes", requireAuth, async (req, res, next) => {
  try {
    const membership = await requireCompanyAccess(req.userId!, req.params.companyId);
    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this company" });
    }
    const disputes = await prisma.vprokDispute.findMany({
      where: { companyId: req.params.companyId },
      include: {
        order: true,
        user: { select: { id: true, email: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json(disputes);
  } catch (err) {
    return next(err);
  }
});

const updateDisputeSchema = z.object({
  status: z.enum(["in_review", "resolved", "rejected"]),
  sellerResponse: z.string().max(4000).optional(),
  resolutionNote: z.string().max(2000).optional()
});

vprokRouter.patch("/disputes/:disputeId", requireAuth, async (req, res, next) => {
  try {
    const dispute = await prisma.vprokDispute.findUnique({
      where: { id: req.params.disputeId }
    });
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const membership = await requireCompanyAccess(req.userId!, dispute.companyId);
    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this dispute" });
    }

    const body = updateDisputeSchema.parse(req.body);
    const updated = await prisma.vprokDispute.update({
      where: { id: dispute.id },
      data: {
        status: body.status,
        sellerResponse: body.sellerResponse?.trim(),
        resolutionNote: body.resolutionNote?.trim()
      }
    });

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.get("/admin/risk-events", async (req, res, next) => {
  try {
    if (!requireModerationKey(req.header("x-moderation-key"))) {
      return res.status(401).json({ error: "Invalid moderation key" });
    }

    const query = z
      .object({
        userId: z.string().optional(),
        code: z.string().optional(),
        scope: z.enum(["order_create", "order_pay"]).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional()
      })
      .parse(req.query);

    const rows = await prisma.vprokRiskEvent.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.code ? { code: query.code } : {}),
        ...(query.scope ? { scope: query.scope } : {})
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        order: { select: { id: true, status: true, totalCents: true, createdAt: true } }
      },
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 50
    });

    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

vprokRouter.get("/admin/risk-events/summary", async (req, res, next) => {
  try {
    if (!requireModerationKey(req.header("x-moderation-key"))) {
      return res.status(401).json({ error: "Invalid moderation key" });
    }

    const query = z
      .object({
        days: z.coerce.number().int().min(1).max(90).optional(),
        top: z.coerce.number().int().min(1).max(50).optional()
      })
      .parse(req.query);

    const days = query.days ?? 7;
    const top = query.top ?? 10;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await prisma.vprokRiskEvent.findMany({
      where: { createdAt: { gte: since } },
      select: {
        code: true,
        scope: true,
        userId: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 5000
    });

    const byCode = new Map<string, number>();
    const byScope = new Map<string, number>();
    const byUser = new Map<
      string,
      { userId: string; email: string; name: string; count: number; lastEventAt: string }
    >();

    for (const row of rows) {
      byCode.set(row.code, (byCode.get(row.code) || 0) + 1);
      byScope.set(row.scope, (byScope.get(row.scope) || 0) + 1);

      const userAgg = byUser.get(row.userId) || {
        userId: row.user.id,
        email: row.user.email,
        name: row.user.name,
        count: 0,
        lastEventAt: row.createdAt.toISOString()
      };
      userAgg.count += 1;
      if (row.createdAt.toISOString() > userAgg.lastEventAt) {
        userAgg.lastEventAt = row.createdAt.toISOString();
      }
      byUser.set(row.userId, userAgg);
    }

    const codes = [...byCode.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
    const scopes = [...byScope.entries()]
      .map(([scope, count]) => ({ scope, count }))
      .sort((a, b) => b.count - a.count);
    const topUsers = [...byUser.values()].sort((a, b) => b.count - a.count).slice(0, top);

    return res.json({
      windowDays: days,
      totalEvents: rows.length,
      byCode: codes,
      byScope: scopes,
      topUsers
    });
  } catch (err) {
    return next(err);
  }
});
