-- CreateEnum
CREATE TYPE "RenderJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'UPLOADING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "status" "RenderJobStatus" NOT NULL DEFAULT 'QUEUED',
    "spec" JSONB NOT NULL,
    "outputAssets" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);
