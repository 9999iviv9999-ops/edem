const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const HOST = "127.0.0.1";
const PORT = Number(process.env.STARTUP_FORUM_PORT || 4211);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "forum-db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const SECTION_IDS = [
  "startup-idea",
  "startup-release",
  "crowdfunding",
  "startup-sale"
];

const SECTION_LABELS = {
  "startup-idea": "Стартап в виде идеи",
  "startup-release": "Релиз стартапов",
  crowdfunding: "Краудфандинг",
  "startup-sale": "Продажа стартапов"
};
const SECTION_RULES = {
  "startup-idea": [
    "Публикуйте только оригинальные идеи с понятной проблемой и ЦА.",
    "Запрещен спам и копирование чужих проектов без разрешения.",
    "Указывайте, какой именно фидбек хотите получить от сообщества."
  ],
  "startup-release": [
    "Релиз-пост должен содержать ссылку на продукт или демо.",
    "Указывайте текущий статус запуска: beta/public/pivot.",
    "Маркетинговые материалы без продукта будут удаляться."
  ],
  crowdfunding: [
    "Публикуйте только реальные кампании с дедлайном и суммой цели.",
    "Площадка не принимает и не обрабатывает платежи участников.",
    "Все переводы идут напрямую между пользователями и их кошельками."
  ],
  "startup-sale": [
    "Указывайте, что именно продается: активы, код, бренд, клиентская база.",
    "Финансовые показатели должны быть описаны без вводящих в заблуждение данных.",
    "Сделки оформляются напрямую между продавцом и покупателем."
  ]
};

const STATUS_VALUES = ["open", "in-progress", "resolved", "closed"];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initialDb = { posts: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialDb, null, 2), "utf8");
  }
}

function loadDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }
  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(absolutePath).pipe(res);
}

function validatePostInput(input) {
  const errors = [];
  if (!input.title || String(input.title).trim().length < 6) {
    errors.push("title_min_6");
  }
  if (!input.summary || String(input.summary).trim().length < 20) {
    errors.push("summary_min_20");
  }
  if (!SECTION_IDS.includes(input.section)) {
    errors.push("invalid_section");
  }
  if (!STATUS_VALUES.includes(input.status)) {
    errors.push("invalid_status");
  }
  if (!input.author || String(input.author).trim().length < 2) {
    errors.push("author_min_2");
  }
  if (!input.goal || String(input.goal).trim().length < 5) {
    errors.push("goal_min_5");
  }
  return errors;
}

function buildPost(payload) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: String(payload.title).trim(),
    summary: String(payload.summary).trim(),
    section: payload.section,
    status: payload.status,
    author: String(payload.author).trim(),
    goal: String(payload.goal).trim(),
    createdAt: now,
    updatedAt: now
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method || "GET";

  if (url.pathname === "/api/meta" && method === "GET") {
    sendJson(res, 200, {
      name: "STARTFLOW Forum",
      sections: SECTION_IDS.map((id) => ({ id, label: SECTION_LABELS[id] })),
      statuses: STATUS_VALUES,
      sectionRules: SECTION_RULES,
      disclaimer: {
        noCustody: true,
        text: "STARTFLOW не участвует в сборе средств и не хранит активы пользователей. Любые переводы выполняются напрямую между сторонами."
      },
      membershipPlans: [
        { id: "user", label: "Обычный пользователь", priceUsd: 10, paymentMethod: "crypto" },
        { id: "gold", label: "Gold", priceUsd: 50, paymentMethod: "crypto" },
        { id: "premium", label: "Premium", priceUsd: 70, paymentMethod: "crypto" }
      ],
      domainNamespace: "startflow-forum",
      appPort: PORT
    });
    return;
  }

  if (url.pathname === "/api/posts" && method === "GET") {
    const db = loadDb();
    db.posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    sendJson(res, 200, { items: db.posts });
    return;
  }

  if (url.pathname === "/api/posts" && method === "POST") {
    try {
      const body = await parseBody(req);
      const errors = validatePostInput(body);
      if (errors.length) {
        sendJson(res, 400, { ok: false, errors });
        return;
      }
      const db = loadDb();
      const post = buildPost(body);
      db.posts.push(post);
      saveDb(db);
      sendJson(res, 201, { ok: true, item: post });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname.startsWith("/api/posts/") && method === "PATCH") {
    const id = url.pathname.replace("/api/posts/", "");
    try {
      const body = await parseBody(req);
      const db = loadDb();
      const index = db.posts.findIndex((item) => item.id === id);
      if (index === -1) {
        sendJson(res, 404, { ok: false, error: "post_not_found" });
        return;
      }

      const target = db.posts[index];
      const nextSection = body.section || target.section;
      const nextStatus = body.status || target.status;

      if (!SECTION_IDS.includes(nextSection) || !STATUS_VALUES.includes(nextStatus)) {
        sendJson(res, 400, { ok: false, error: "invalid_update_payload" });
        return;
      }

      db.posts[index] = {
        ...target,
        section: nextSection,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      };
      saveDb(db);
      sendJson(res, 200, { ok: true, item: db.posts[index] });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/public/"))) {
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname.replace("/public", "");
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
    const absolutePath = path.join(PUBLIC_DIR, safePath);
    sendFile(res, absolutePath);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`STARTFLOW Forum running at http://${HOST}:${PORT}`);
});
