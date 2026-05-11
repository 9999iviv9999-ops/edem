-- AlterTable
ALTER TABLE "Message" ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentMime" TEXT,
ADD COLUMN "attachmentFilename" TEXT,
ADD COLUMN "attachmentSize" INTEGER;

ALTER TABLE "Message" ALTER COLUMN "text" SET DEFAULT '';
