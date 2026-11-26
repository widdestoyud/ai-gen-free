-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "category" TEXT,
    "modelId" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '1:1',
    "isSpicy" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "coverStorageKey" TEXT NOT NULL,
    "coverWidth" INTEGER NOT NULL DEFAULT 0,
    "coverHeight" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateImage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "alias" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_isActive_isSpicy_sortOrder_createdAt_idx" ON "Template"("isActive", "isSpicy", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Template_isActive_isSpicy_usageCount_idx" ON "Template"("isActive", "isSpicy", "usageCount");

-- CreateIndex
CREATE INDEX "Template_category_isActive_idx" ON "Template"("category", "isActive");

-- CreateIndex
CREATE INDEX "TemplateImage_templateId_position_idx" ON "TemplateImage"("templateId", "position");

-- AddForeignKey
ALTER TABLE "TemplateImage" ADD CONSTRAINT "TemplateImage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
