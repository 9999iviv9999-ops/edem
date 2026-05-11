-- Выполнять от суперпользователя БД (postgres), если migrate от edem_app упал с «must be owner».
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentMime" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentFilename" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentSize" INTEGER;
ALTER TABLE "Message" ALTER COLUMN "text" SET DEFAULT '';
