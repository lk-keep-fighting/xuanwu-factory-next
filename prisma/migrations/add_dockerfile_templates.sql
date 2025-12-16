-- CreateTable
CREATE TABLE "dockerfile_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "base_image" TEXT NOT NULL,
    "workdir" TEXT NOT NULL DEFAULT '/app',
    "copy_files" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "install_commands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "build_commands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "run_command" TEXT NOT NULL,
    "expose_ports" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "env_vars" JSONB DEFAULT '{}',
    "dockerfile_content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "dockerfile_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dockerfile_templates_id_key" ON "dockerfile_templates"("id");

-- CreateIndex
CREATE INDEX "dockerfile_templates_category_idx" ON "dockerfile_templates"("category");

-- CreateIndex
CREATE INDEX "dockerfile_templates_is_active_idx" ON "dockerfile_templates"("is_active");

-- CreateIndex
CREATE INDEX "dockerfile_templates_is_system_idx" ON "dockerfile_templates"("is_system");