#!/usr/bin/env node
/**
 * После npm install/ci: prisma generate, если схема уже в дереве.
 * В Docker на шаге «только package*.json» схемы нет — пропускаем без ошибки.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const schema = resolve(process.cwd(), "prisma/schema.prisma");
if (!existsSync(schema)) {
  console.log("postinstall: prisma/schema.prisma нет — пропускаем generate (типично слой Docker до COPY .)");
  process.exit(0);
}

const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
if (!existsSync(prismaCli)) {
  console.warn("postinstall: prisma CLI не найден — пропускаем");
  process.exit(0);
}

const r = spawnSync(process.execPath, [prismaCli, "generate"], { stdio: "inherit" });
process.exit(r.status ?? 1);
