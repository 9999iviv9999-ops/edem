import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";

type Campaign = {
  id: string;
  ownerPhone: string;
  title: string;
  story: string;
  category: string;
  targetRub: number;
  raisedRub: number;
  status: "draft" | "active" | "frozen";
  complaintsCount: number;
  videoUrls: string[];
  payoutMethod: "sbp_phone" | "phone" | "card";
  payoutTarget: string;
  payoutRecipientName: string;
  socialLinks?: {
    vk?: string;
    telegram?: string;
    website?: string;
  };
  createdAt: string;
};

type TransferConfirmation = {
  id: string;
  campaignId: string;
  amountRub: number;
  confirmedAt: string;
  donorConsent: true;
  ip: string;
  userAgent: string;
  receiptUrl?: string;
};

type AdminRole = "moderator" | "ops" | "superadmin";
type SubscriptionPlan = "monthly" | "half_year" | "yearly";
type SubscriptionStatus = "active" | "inactive";
type Subscription = {
  id: string;
  ownerPhone: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  autoRenew: boolean;
};
type SubscriptionInvoiceStatus = "pending" | "processing" | "paid" | "failed";
type SubscriptionInvoice = {
  id: string;
  ownerPhone: string;
  plan: SubscriptionPlan;
  amountRub: number;
  status: SubscriptionInvoiceStatus;
  paymentUrl: string;
  createdAt: string;
  updatedAt: string;
  operatorId?: string;
  externalRef?: string;
  statusReason?: string;
};

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS ?? "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes("*") || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS blocked"));
    }
  })
);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 400),
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.json());
app.set("trust proxy", true);

const runtimeBaseDir = process.env.VERCEL ? "/tmp/skinulis" : process.cwd();
const uploadsDir = path.resolve(runtimeBaseDir, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const dataDir = path.resolve(runtimeBaseDir, "data");
const stateFile = path.join(dataDir, "state.json");
fs.mkdirSync(dataDir, { recursive: true });

type PersistedState = {
  campaigns: Campaign[];
  transferConfirmations: TransferConfirmation[];
  subscriptions: Subscription[];
  subscriptionInvoices: SubscriptionInvoice[];
};

function readPersistedState(): PersistedState {
  if (!fs.existsSync(stateFile)) {
    return {
      campaigns: [],
      transferConfirmations: [],
      subscriptions: [],
      subscriptionInvoices: []
    };
  }
  try {
    const raw = fs.readFileSync(stateFile, "utf-8");
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      campaigns: parsed.campaigns ?? [],
      transferConfirmations: parsed.transferConfirmations ?? [],
      subscriptions: parsed.subscriptions ?? [],
      subscriptionInvoices: parsed.subscriptionInvoices ?? []
    };
  } catch {
    return {
      campaigns: [],
      transferConfirmations: [],
      subscriptions: [],
      subscriptionInvoices: []
    };
  }
}

function persistState() {
  const snapshot: PersistedState = {
    campaigns,
    transferConfirmations,
    subscriptions,
    subscriptionInvoices
  };
  const tempFile = `${stateFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(snapshot, null, 2), "utf-8");
  fs.renameSync(tempFile, stateFile);
}
const initialState = readPersistedState();
const campaigns: Campaign[] = initialState.campaigns;
const transferConfirmations: TransferConfirmation[] = initialState.transferConfirmations;
const subscriptions: Subscription[] = initialState.subscriptions;
const subscriptionInvoices: SubscriptionInvoice[] = initialState.subscriptionInvoices;
const adminKeys: Record<AdminRole, string> = {
  moderator: process.env.MODERATOR_KEY ?? "skinulis-dev-moderator-key",
  ops: process.env.OPS_KEY ?? "skinulis-dev-ops-key",
  superadmin: process.env.SUPERADMIN_KEY ?? "skinulis-dev-superadmin-key"
};
const processingCallbackSecret = process.env.PROCESSING_CALLBACK_SECRET ?? "skinulis-dev-processing-secret";
const subscriptionsEnabled = (process.env.SUBSCRIPTIONS_ENABLED ?? "true").toLowerCase() !== "false";
const freeActiveCampaignLimit = Number(process.env.FREE_ACTIVE_CAMPAIGN_LIMIT ?? 1);
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Unsupported video format"));
      return;
    }
    cb(null, true);
  }
});
const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Unsupported receipt format"));
      return;
    }
    cb(null, true);
  }
});

const createCampaignSchema = z.object({
  ownerPhone: z.string().min(10),
  title: z.string().min(5).max(120),
  story: z.string().min(20).max(2500),
  category: z.string().min(2),
  targetRub: z.number().int().positive(),
  payoutMethod: z.enum(["sbp_phone", "phone", "card"]),
  payoutTarget: z.string().min(10).max(30),
  payoutRecipientName: z.string().min(3).max(120),
  socialLinks: z
    .object({
      vk: z.string().url().max(200).optional(),
      telegram: z.string().url().max(200).optional(),
      website: z.string().url().max(200).optional()
    })
    .optional()
});

const donationSchema = z.object({
  amountRub: z.number().int().positive().max(50000)
});

const transferConfirmationSchema = z.object({
  amountRub: z.number().int().positive().max(50000),
  donorConsent: z.literal(true)
});

const complaintSchema = z.object({
  reason: z.string().min(5).max(500)
});
const createSubscriptionInvoiceSchema = z.object({
  ownerPhone: z.string().min(10),
  plan: z.enum(["monthly", "half_year", "yearly"])
});
const subscriptionManualResultSchema = z.object({
  invoiceId: z.string().min(3),
  status: z.enum(["paid", "failed"]),
  operatorId: z.string().min(2),
  externalRef: z.string().optional(),
  statusReason: z.string().max(300).optional()
});
const subscriptionAdminCompleteSchema = z.object({
  status: z.enum(["paid", "failed"]),
  operatorId: z.string().min(2),
  externalRef: z.string().optional(),
  statusReason: z.string().max(300).optional()
});

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function validatePayoutTarget(method: Campaign["payoutMethod"], target: string): boolean {
  if (method === "card") {
    const digits = onlyDigits(target);
    return digits.length >= 16 && digits.length <= 19;
  }
  const digits = onlyDigits(target);
  return digits.length === 11;
}

function hasAdminRole(req: express.Request, roles: AdminRole[]): boolean {
  const role = req.header("x-admin-role") as AdminRole | undefined;
  const key = req.header("x-admin-key");
  if (!role || !roles.includes(role)) {
    return false;
  }
  return key === adminKeys[role];
}

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const insecure = [
    adminKeys.moderator === "skinulis-dev-moderator-key",
    adminKeys.ops === "skinulis-dev-ops-key",
    adminKeys.superadmin === "skinulis-dev-superadmin-key",
    processingCallbackSecret === "skinulis-dev-processing-secret"
  ].some(Boolean);

  if (insecure) {
    throw new Error("Refusing to start in production with default secrets.");
  }
}

function addMonths(dateIso: string, months: number): string {
  const date = new Date(dateIso);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function planMonths(plan: SubscriptionPlan): number {
  if (plan === "monthly") return 1;
  if (plan === "half_year") return 6;
  return 12;
}

function planAmount(plan: SubscriptionPlan): number {
  if (plan === "monthly") return 299;
  if (plan === "half_year") return 1499;
  return 2299;
}

function activeCampaignLimit(plan: SubscriptionPlan): number {
  if (plan === "monthly") return 1;
  if (plan === "half_year") return 2;
  return 4;
}

function getActiveSubscription(ownerPhone: string): Subscription | undefined {
  const now = Date.now();
  return subscriptions.find(
    (item) => item.ownerPhone === ownerPhone && item.status === "active" && new Date(item.periodEnd).getTime() > now
  );
}

function applySubscriptionInvoiceStatus(invoice: SubscriptionInvoice, status: "paid" | "failed", details: {
  operatorId?: string;
  externalRef?: string;
  statusReason?: string;
}) {
  invoice.status = status;
  invoice.updatedAt = new Date().toISOString();
  invoice.operatorId = details.operatorId;
  invoice.externalRef = details.externalRef;
  invoice.statusReason = details.statusReason;

  if (status === "paid") {
    const now = new Date().toISOString();
    const existingActive = getActiveSubscription(invoice.ownerPhone);
    if (existingActive) {
      existingActive.periodEnd = addMonths(existingActive.periodEnd, planMonths(invoice.plan));
      existingActive.plan = invoice.plan;
    } else {
      subscriptions.unshift({
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ownerPhone: invoice.ownerPhone,
        plan: invoice.plan,
        status: "active",
        periodStart: now,
        periodEnd: addMonths(now, planMonths(invoice.plan)),
        autoRenew: false
      });
    }
  }
  persistState();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "skinulis-api" });
});

app.get("/health/live", (_req, res) => {
  res.json({ ok: true });
});

app.get("/health/ready", (_req, res) => {
  const writable = fs.existsSync(dataDir) && fs.existsSync(uploadsDir);
  if (!writable) {
    return res.status(503).json({ ok: false, reason: "Storage directories unavailable" });
  }
  return res.json({ ok: true });
});

app.get("/v1/campaigns", (_req, res) => {
  const query = _req.query;
  const q = String(query.q ?? "").trim().toLowerCase();
  const category = String(query.category ?? "").trim().toLowerCase();
  const sort = String(query.sort ?? "newest");
  const pageRaw = Number(query.page ?? 1);
  const limitRaw = Number(query.limit ?? 12);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, Math.floor(limitRaw)) : 12;

  let items = campaigns.filter((item) => item.status === "active");
  if (q) {
    items = items.filter((item) => {
      const haystack = `${item.title} ${item.story} ${item.category}`.toLowerCase();
      return haystack.includes(q);
    });
  }
  if (category) {
    items = items.filter((item) => item.category.toLowerCase() === category);
  }

  if (sort === "goal_asc") {
    items = [...items].sort((a, b) => a.targetRub - b.targetRub);
  } else if (sort === "raised_desc") {
    items = [...items].sort((a, b) => b.raisedRub - a.raisedRub);
  } else if (sort === "progress_asc") {
    items = [...items].sort((a, b) => {
      const ap = a.targetRub > 0 ? a.raisedRub / a.targetRub : 0;
      const bp = b.targetRub > 0 ? b.raisedRub / b.targetRub : 0;
      return ap - bp;
    });
  } else {
    items = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const pagedItems = items.slice(offset, offset + limit);
  const categories = Array.from(new Set(campaigns.filter((item) => item.status === "active").map((item) => item.category))).sort(
    (a, b) => a.localeCompare(b, "ru")
  );

  res.json({
    items: pagedItems,
    meta: { page: safePage, limit, total, totalPages },
    categories
  });
});

app.get("/v1/public-config", (_req, res) => {
  return res.json({
    subscriptionsEnabled,
    freeActiveCampaignLimit
  });
});

app.post("/v1/campaigns", (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!validatePayoutTarget(parsed.data.payoutMethod, parsed.data.payoutTarget)) {
    return res.status(400).json({ error: "Invalid payout requisites format" });
  }

  const activeCount = campaigns.filter(
    (item) => item.ownerPhone === parsed.data.ownerPhone && item.status === "active"
  ).length;
  if (subscriptionsEnabled) {
    const subscription = getActiveSubscription(parsed.data.ownerPhone);
    if (!subscription) {
      return res.status(402).json({ error: "Active subscription required to publish campaigns" });
    }
    if (activeCount >= activeCampaignLimit(subscription.plan)) {
      return res.status(409).json({ error: "Active campaign limit reached for your subscription plan" });
    }
  } else if (activeCount >= freeActiveCampaignLimit) {
    return res.status(409).json({ error: "Free mode active campaign limit reached" });
  }

  const id = `cmp_${Date.now()}`;
  const campaign: Campaign = {
    id,
    ownerPhone: parsed.data.ownerPhone,
    title: parsed.data.title,
    story: parsed.data.story,
    category: parsed.data.category,
    targetRub: parsed.data.targetRub,
    raisedRub: 0,
    status: "active",
    complaintsCount: 0,
    videoUrls: [],
    payoutMethod: parsed.data.payoutMethod,
    payoutTarget: parsed.data.payoutTarget,
    payoutRecipientName: parsed.data.payoutRecipientName,
    socialLinks: parsed.data.socialLinks ?? {},
    createdAt: new Date().toISOString()
  };

  campaigns.unshift(campaign);
  persistState();
  return res.status(201).json(campaign);
});

app.post("/v1/subscriptions/invoice", (req, res) => {
  if (!subscriptionsEnabled) {
    return res.status(409).json({ error: "Subscriptions are disabled in this environment" });
  }
  const parsed = createSubscriptionInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const existing = subscriptionInvoices.find(
    (item) => item.ownerPhone === parsed.data.ownerPhone && (item.status === "pending" || item.status === "processing")
  );
  if (existing) {
    return res.json(existing);
  }
  const invoice: SubscriptionInvoice = {
    id: `sinv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ownerPhone: parsed.data.ownerPhone,
    plan: parsed.data.plan,
    amountRub: planAmount(parsed.data.plan),
    status: "pending",
    paymentUrl: `/manual-subscription/${parsed.data.ownerPhone}/${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  subscriptionInvoices.unshift(invoice);
  persistState();
  return res.status(201).json(invoice);
});

app.get("/v1/subscriptions/status", (req, res) => {
  if (!subscriptionsEnabled) {
    return res.json({ subscription: null, latestInvoice: null, disabled: true });
  }
  const ownerPhone = String(req.query.ownerPhone ?? "");
  if (!ownerPhone) {
    return res.status(400).json({ error: "ownerPhone is required" });
  }
  const active = getActiveSubscription(ownerPhone) ?? null;
  const latestInvoice = subscriptionInvoices.find((item) => item.ownerPhone === ownerPhone) ?? null;
  return res.json({ subscription: active, latestInvoice });
});

app.post("/v1/campaigns/:id/videos", videoUpload.single("video"), (req, res) => {
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Video file is required" });
  }

  const videoUrl = `/uploads/${req.file.filename}`;
  campaign.videoUrls.push(videoUrl);
  persistState();
  return res.status(201).json({ campaignId: campaign.id, videoUrl });
});

app.post("/v1/campaigns/:id/donations", (req, res) => {
  const parsed = donationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = campaigns.find((c) => c.id === req.params.id && c.status === "active");
  if (!campaign) {
    return res.status(404).json({ error: "Active campaign not found" });
  }

  campaign.raisedRub += parsed.data.amountRub;
  persistState();
  return res.status(201).json({ campaignId: campaign.id, raisedRub: campaign.raisedRub });
});

app.post("/v1/campaigns/:id/transfer-confirmations", (req, res) => {
  const parsed = transferConfirmationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = campaigns.find((c) => c.id === req.params.id && c.status === "active");
  if (!campaign) {
    return res.status(404).json({ error: "Active campaign not found" });
  }

  campaign.raisedRub += parsed.data.amountRub;
  const confirmation: TransferConfirmation = {
    id: `trc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    campaignId: campaign.id,
    amountRub: parsed.data.amountRub,
    confirmedAt: new Date().toISOString(),
    donorConsent: true,
    ip: req.ip ?? "unknown",
    userAgent: req.get("user-agent") ?? "unknown"
  };
  transferConfirmations.unshift(confirmation);
  persistState();

  return res.status(201).json({
    campaignId: campaign.id,
    raisedRub: campaign.raisedRub,
    confirmationId: confirmation.id
  });
});

app.get("/v1/campaigns/:id/transfer-confirmations", (req, res) => {
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  const items = transferConfirmations.filter((item) => item.campaignId === campaign.id);
  return res.json(items);
});

app.post("/v1/transfer-confirmations/:id/receipt", receiptUpload.single("receipt"), (req, res) => {
  const confirmation = transferConfirmations.find((item) => item.id === req.params.id);
  if (!confirmation) {
    return res.status(404).json({ error: "Transfer confirmation not found" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Receipt file is required" });
  }
  confirmation.receiptUrl = `/uploads/${req.file.filename}`;
  persistState();
  return res.status(201).json({ confirmationId: confirmation.id, receiptUrl: confirmation.receiptUrl });
});

app.get("/v1/admin/campaigns", (req, res) => {
  if (!hasAdminRole(req, ["moderator", "superadmin"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json(campaigns);
});

app.get("/v1/admin/auth-check", (req, res) => {
  const role = req.header("x-admin-role") as AdminRole | undefined;
  if (!role || !["moderator", "ops", "superadmin"].includes(role)) {
    return res.status(400).json({ error: "Invalid admin role" });
  }
  if (!hasAdminRole(req, [role])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({ ok: true, role });
});

app.get("/v1/admin/transfer-confirmations", (req, res) => {
  if (!hasAdminRole(req, ["ops", "superadmin"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json(transferConfirmations);
});

app.get("/v1/admin/placement-payments", (req, res) => {
  if (!hasAdminRole(req, ["ops", "superadmin"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json(subscriptionInvoices);
});

app.get("/v1/admin/subscriptions", (req, res) => {
  if (!hasAdminRole(req, ["ops", "superadmin"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json(subscriptions);
});

app.post("/v1/admin/placement-payments/:id/enqueue", (req, res) => {
  if (!hasAdminRole(req, ["ops", "superadmin"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const invoice = subscriptionInvoices.find((item) => item.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: "Subscription invoice not found" });
  }
  if (invoice.status !== "pending") {
    return res.status(409).json({ error: "Only pending payments can be enqueued" });
  }
  invoice.status = "processing";
  invoice.updatedAt = new Date().toISOString();
  persistState();
  return res.json(invoice);
});

app.post("/v1/admin/placement-payments/:id/complete", (req, res) => {
  if (!hasAdminRole(req, ["ops", "superadmin"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = subscriptionAdminCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const invoice = subscriptionInvoices.find((item) => item.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: "Subscription invoice not found" });
  }
  if (invoice.status === "paid" || invoice.status === "failed") {
    return res.json(invoice);
  }
  applySubscriptionInvoiceStatus(invoice, parsed.data.status, parsed.data);
  return res.json(invoice);
});

app.post("/v1/payments/placement/manual-result", (req, res) => {
  if (req.header("x-processing-secret") !== processingCallbackSecret) {
    return res.status(401).json({ error: "Unauthorized processing callback" });
  }
  const parsed = subscriptionManualResultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const invoice = subscriptionInvoices.find((item) => item.id === parsed.data.invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: "Subscription invoice not found" });
  }
  if (invoice.status === "paid" || invoice.status === "failed") {
    return res.json({ ok: true, invoice });
  }
  applySubscriptionInvoiceStatus(invoice, parsed.data.status, parsed.data);
  return res.json({ ok: true, invoice });
});

app.post("/v1/payments/subscription/manual-result", (req, res) => {
  if (req.header("x-processing-secret") !== processingCallbackSecret) {
    return res.status(401).json({ error: "Unauthorized processing callback" });
  }
  const parsed = subscriptionManualResultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const invoice = subscriptionInvoices.find((item) => item.id === parsed.data.invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: "Subscription invoice not found" });
  }
  if (invoice.status === "paid" || invoice.status === "failed") {
    return res.json({ ok: true, invoice });
  }
  applySubscriptionInvoiceStatus(invoice, parsed.data.status, parsed.data);
  return res.json({ ok: true, invoice });
});

app.post("/v1/campaigns/:id/complaints", (req, res) => {
  const parsed = complaintSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  campaign.complaintsCount += 1;
  if (campaign.complaintsCount >= 3) {
    campaign.status = "frozen";
  }
  persistState();

  return res.status(201).json({
    campaignId: campaign.id,
    complaintsCount: campaign.complaintsCount,
    status: campaign.status
  });
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error.message.includes("Unsupported")) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Internal server error" });
});

export { app };
export default app;

if (!process.env.VERCEL) {
  assertProductionSecrets();
  const port = Number(process.env.PORT ?? 4010);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Skinulis API listening on http://localhost:${port}`);
  });
}

