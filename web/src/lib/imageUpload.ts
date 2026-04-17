export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export type CropAspect = "1:1" | "4:3";

export function validateProductImage(file: File): string | null {
  if (!PRODUCT_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return "Допустимы только JPG, PNG, WEBP.";
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return "Файл слишком большой. Максимум 5MB.";
  }
  return null;
}

export async function compressImageFile(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), mime, quality);
  });
}

export async function cropAndCompressImageFile(
  file: File,
  aspect: CropAspect,
  maxSide = 1600,
  quality = 0.82
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = aspect === "1:1" ? 1 : 4 / 3;
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  let cropW = srcW;
  let cropH = Math.round(srcW / ratio);
  if (cropH > srcH) {
    cropH = srcH;
    cropW = Math.round(srcH * ratio);
  }

  const sx = Math.max(0, Math.floor((srcW - cropW) / 2));
  const sy = Math.max(0, Math.floor((srcH - cropH) / 2));

  const scale = Math.min(1, maxSide / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, outW, outH);

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), mime, quality);
  });
}
