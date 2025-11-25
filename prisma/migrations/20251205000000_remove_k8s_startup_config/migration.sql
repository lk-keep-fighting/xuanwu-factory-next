-- Remove k8s_startup_config column from services table
ALTER TABLE `services`
  DROP COLUMN `k8s_startup_config`;