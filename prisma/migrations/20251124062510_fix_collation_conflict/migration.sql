-- AlterTable
ALTER TABLE `system_configs` MODIFY `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE `projects` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NOT NULL,

    UNIQUE INDEX `projects_identifier_key`(`identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `env_vars` JSON NULL,
    `resource_limits` JSON NULL,
    `volumes` JSON NULL,
    `network_config` JSON NULL,
    `git_provider` VARCHAR(32) NULL,
    `git_repository` VARCHAR(191) NULL,
    `git_branch` VARCHAR(191) NULL,
    `git_path` VARCHAR(191) NULL,
    `build_type` VARCHAR(32) NULL,
    `dockerfile_path` VARCHAR(191) NULL,
    `build_args` JSON NULL,
    `port` INTEGER NULL,
    `replicas` INTEGER NULL,
    `command` VARCHAR(191) NULL,
    `auto_deploy` BOOLEAN NOT NULL DEFAULT false,
    `built_image` VARCHAR(191) NULL,
    `database_type` VARCHAR(32) NULL,
    `version` VARCHAR(191) NULL,
    `external_port` INTEGER NULL,
    `username` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `root_password` VARCHAR(191) NULL,
    `database_name` VARCHAR(191) NULL,
    `volume_size` VARCHAR(191) NULL,
    `internal_host` VARCHAR(191) NULL,
    `internal_connection_url` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `tag` VARCHAR(191) NULL,
    `health_check` JSON NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NOT NULL,

    INDEX `services_project_id_idx`(`project_id`),
    INDEX `services_type_idx`(`type`),
    INDEX `services_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_images` (
    `id` CHAR(36) NOT NULL,
    `service_id` CHAR(36) NOT NULL,
    `image` VARCHAR(512) NOT NULL,
    `tag` VARCHAR(191) NOT NULL DEFAULT 'latest',
    `full_image` VARCHAR(512) NOT NULL,
    `digest` VARCHAR(255) NULL,
    `build_number` INTEGER NULL,
    `build_status` VARCHAR(32) NOT NULL DEFAULT 'building',
    `build_source` VARCHAR(32) NOT NULL DEFAULT 'jenkins',
    `build_logs` LONGTEXT NULL,
    `metadata` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NOT NULL,

    INDEX `service_images_service_id_idx`(`service_id`),
    INDEX `service_images_build_status_idx`(`build_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deployments` (
    `id` CHAR(36) NOT NULL,
    `service_id` CHAR(36) NOT NULL,
    `service_image_id` CHAR(36) NULL,
    `status` VARCHAR(32) NOT NULL,
    `build_logs` LONGTEXT NULL,
    `image_tag` VARCHAR(191) NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` TIMESTAMP(3) NULL,

    INDEX `deployments_service_id_idx`(`service_id`),
    INDEX `deployments_service_image_id_idx`(`service_image_id`),
    INDEX `deployments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requirements` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `last_ai_dispatch_at` TIMESTAMP(3) NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NOT NULL,

    INDEX `requirements_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requirement_services` (
    `id` CHAR(36) NOT NULL,
    `requirement_id` CHAR(36) NOT NULL,
    `service_id` CHAR(36) NOT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `requirement_services_service_id_idx`(`service_id`),
    UNIQUE INDEX `requirement_services_requirement_id_service_id_key`(`requirement_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requirement_task_links` (
    `id` CHAR(36) NOT NULL,
    `requirement_id` CHAR(36) NOT NULL,
    `ai_employee_id` VARCHAR(191) NOT NULL,
    `ai_employee_name` VARCHAR(191) NOT NULL,
    `ai_employee_type` VARCHAR(32) NOT NULL,
    `ai_task_assignment_id` VARCHAR(191) NOT NULL,
    `task_title` VARCHAR(255) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `service_id` CHAR(36) NULL,
    `branch_name` VARCHAR(191) NULL,
    `expected_outputs` JSON NULL,
    `priority` VARCHAR(16) NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `result_summary` TEXT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NOT NULL,

    INDEX `requirement_task_links_requirement_id_idx`(`requirement_id`),
    INDEX `requirement_task_links_project_id_idx`(`project_id`),
    INDEX `requirement_task_links_service_id_idx`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_images` ADD CONSTRAINT `service_images_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_service_image_id_fkey` FOREIGN KEY (`service_image_id`) REFERENCES `service_images`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requirement_services` ADD CONSTRAINT `requirement_services_requirement_id_fkey` FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requirement_services` ADD CONSTRAINT `requirement_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requirement_task_links` ADD CONSTRAINT `requirement_task_links_requirement_id_fkey` FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requirement_task_links` ADD CONSTRAINT `requirement_task_links_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
