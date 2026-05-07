import { Router } from "express";
import multer from "multer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "../middleware/auth";
import { uploadImageToS3 } from "../lib/s3";

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
        url = await uploadImageToS3(key, req.file.buffer, req.file.mimetype);
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
