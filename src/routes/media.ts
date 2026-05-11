import { Router } from "express";
import multer from "multer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "../middleware/auth";
import { uploadObjectToS3 } from "../lib/s3";

function validateImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;
  return false;
}

const ALLOWED_UPLOAD_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

export const mediaRouter = Router();

mediaRouter.post(
  "/upload-photo",
  requireAuth,
  upload.single("photo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Only image uploads are allowed" });
      }
      if (!validateImageMagicBytes(req.file.buffer)) {
        return res.status(400).json({ error: "Invalid image data" });
      }

      const extRaw = (req.file.mimetype.split("/")[1] || "jpg").toLowerCase().split(";")[0];
      const ext = extRaw === "jpeg" ? "jpg" : extRaw;
      if (!ALLOWED_UPLOAD_EXT.has(ext)) {
        return res.status(400).json({ error: "Only jpeg, png, gif, webp are allowed" });
      }
      const key = `users/${req.userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      let url: string;
      try {
        url = await uploadObjectToS3(key, req.file.buffer, req.file.mimetype);
      } catch {
        const uploadsDir = path.join(process.cwd(), "uploads", "users", String(req.userId));
        await mkdir(uploadsDir, { recursive: true });
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const fullPath = path.join(uploadsDir, filename);
        await writeFile(fullPath, req.file.buffer);
        url = `/uploads/users/${req.userId}/${filename}`;
      }
      return res.status(201).json({ url, key });
    } catch (err) {
      return next(err);
    }
  }
);

const CHAT_FILE_MAX = 12 * 1024 * 1024;
const CHAT_TEXT_MAX = 512 * 1024;

const OOXML_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

const chatFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_FILE_MAX }
});

function isPdfBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

function isZipBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) && (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08);
}

function isOleCompoundFile(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  );
}

function safeChatOriginalName(name: string | undefined): string {
  const raw = (name || "file")
    .replace(/[/\\?\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 180);
  const cleaned = raw.replace(/[^a-zA-Zа-яА-ЯёЁ0-9._\-()\s]/g, "_").replace(/\s+/g, " ");
  return cleaned.trim() || "file";
}

/**
 * Классификация вложения для чата: изображения, PDF, Office (OOXML / старый OLE), plain text.
 */
function classifyChatUpload(
  buffer: Buffer,
  mimeRaw: string,
  originalname: string
): { ext: string; contentType: string } | { error: string } {
  const mime = (mimeRaw || "").split(";")[0].trim().toLowerCase();
  const extFromName = path.extname(originalname || "").slice(1).toLowerCase();

  if (mime.startsWith("image/")) {
    if (!validateImageMagicBytes(buffer)) return { error: "Invalid image data" };
    const extRaw = (mime.split("/")[1] || extFromName || "jpg").toLowerCase().split("+")[0];
    const ext = extRaw === "jpeg" ? "jpg" : extRaw;
    if (!ALLOWED_UPLOAD_EXT.has(ext)) return { error: "Unsupported image type" };
    return { ext, contentType: mimeRaw.split(";")[0].trim() };
  }

  if (mime === "application/pdf" || extFromName === "pdf") {
    if (!isPdfBuffer(buffer)) return { error: "Invalid PDF data" };
    return { ext: "pdf", contentType: "application/pdf" };
  }

  if (OOXML_MIMES.has(mime)) {
    if (!isZipBuffer(buffer)) return { error: "Invalid document data" };
    if (mime.includes("wordprocessingml")) return { ext: "docx", contentType: mime };
    if (mime.includes("spreadsheetml")) return { ext: "xlsx", contentType: mime };
    if (mime.includes("presentationml")) return { ext: "pptx", contentType: mime };
    return { ext: "bin", contentType: mime };
  }

  if (isOleCompoundFile(buffer)) {
    if (extFromName === "doc" || mime === "application/msword") {
      return { ext: "doc", contentType: "application/msword" };
    }
    if (extFromName === "xls" || mime === "application/vnd.ms-excel") {
      return { ext: "xls", contentType: "application/vnd.ms-excel" };
    }
    return { error: "Unsupported legacy Office file" };
  }

  if (mime === "text/plain" || extFromName === "txt") {
    if (buffer.length > CHAT_TEXT_MAX) return { error: "Text file too large (max 512KB)" };
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0) return { error: "Binary data not allowed in text/plain" };
    }
    return { ext: "txt", contentType: "text/plain; charset=utf-8" };
  }

  return { error: "Unsupported file type for chat" };
}

mediaRouter.post(
  "/upload-chat-file",
  requireAuth,
  chatFileUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const classified = classifyChatUpload(req.file.buffer, req.file.mimetype, req.file.originalname);
      if ("error" in classified) {
        return res.status(400).json({ error: classified.error });
      }
      const { ext, contentType } = classified;
      const key = `users/${req.userId}/chat/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const displayName = safeChatOriginalName(req.file.originalname);
      const size = req.file.buffer.length;
      let url: string;
      try {
        url = await uploadObjectToS3(key, req.file.buffer, contentType);
      } catch {
        const uploadsDir = path.join(process.cwd(), "uploads", "users", String(req.userId), "chat");
        await mkdir(uploadsDir, { recursive: true });
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const fullPath = path.join(uploadsDir, filename);
        await writeFile(fullPath, req.file.buffer);
        url = `/uploads/users/${req.userId}/chat/${filename}`;
      }
      return res.status(201).json({
        url,
        mimeType: contentType,
        filename: displayName,
        size
      });
    } catch (err) {
      return next(err);
    }
  }
);
