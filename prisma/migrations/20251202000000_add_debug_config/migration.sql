-- AlterTable
ALTER TABLE `services` ADD COLUMN `debug_config` JSON NULL AFTER `health_check`;
