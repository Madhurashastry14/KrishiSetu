import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../auth.js";
import { ApiError } from "../errors.js";

export const uploadRouter = Router();
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
const allowedTypes = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]);
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, callback) => {
      try {
        await mkdir(directory, { recursive: true });
        callback(null, directory);
      } catch (error) {
        callback(error);
      }
    },
    filename: (req, file, callback) => callback(null, `${randomUUID()}${allowedTypes.get(file.mimetype) || ".img"}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => allowedTypes.has(file.mimetype) ? callback(null, true) : callback(new ApiError(400, "Upload a JPG, PNG or WebP image."))
});

uploadRouter.post("/", requireAuth, (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) return next(error instanceof multer.MulterError ? new ApiError(400, error.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller." : "Only one image can be uploaded.") : error);
    if (!req.file) return next(new ApiError(400, "Choose an image to upload."));
    res.status(201).json({ data: { imageUrl: `/uploads/${req.file.filename}` } });
  });
});
