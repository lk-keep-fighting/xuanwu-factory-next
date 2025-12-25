-- AlterTable
ALTER TABLE `services` ADD COLUMN `mysql_config` JSON NULL;

-- CreateTable
CREATE TABLE `dockerfile_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `base_image` VARCHAR(512) NOT NULL,
    `workdir` VARCHAR(255) NOT NULL DEFAULT '/app',
    `copy_files` JSON NULL,
    `install_commands` JSON NULL,
    `build_commands` JSON NULL,
    `run_command` VARCHAR(512) NOT NULL,
    `expose_ports` JSON NULL,
    `env_vars` JSON NULL,
    `dockerfile_content` LONGTEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NOT NULL,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,

    INDEX `dockerfile_templates_category_idx`(`category`),
    INDEX `dockerfile_templates_is_active_idx`(`is_active`),
    INDEX `dockerfile_templates_is_system_idx`(`is_system`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_diagnostics` (
    `id` CHAR(36) NOT NULL,
    `serviceId` CHAR(36) NOT NULL,
    `diagnosticTime` TIMESTAMP(3) NOT NULL,
    `conclusion` VARCHAR(255) NOT NULL,
    `diagnostician` VARCHAR(191) NOT NULL,
    `reportCategory` VARCHAR(191) NOT NULL,
    `reportDetail` LONGTEXT NOT NULL,
    `severity` VARCHAR(50) NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `service_diagnostics_serviceId_idx`(`serviceId`),
    INDEX `service_diagnostics_diagnosticTime_idx`(`diagnosticTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_diagnostics` ADD CONSTRAINT `service_diagnostics_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
