import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { uploadImageToS3 } from "../lib/s3";

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

      const ext = req.file.mimetype.split("/")[1] || "jpg";
      const key = `users/${req.userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const url = await uploadImageToS3(key, req.file.buffer, req.file.mimetype);
      return res.status(201).json({ url, key });
    } catch (err) {
      return next(err);
    }
  }
);
