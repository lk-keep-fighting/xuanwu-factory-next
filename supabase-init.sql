-- Requirements module tables
CREATE TABLE IF NOT EXISTS `requirements` (
  `id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `project_id` char(36) NOT NULL,
  `last_ai_dispatch_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `idx_requirements_project_id` (`project_id`),
  CONSTRAINT `fk_requirements_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `requirement_services` (
  `id` char(36) NOT NULL,
  `requirement_id` char(36) NOT NULL,
  `service_id` char(36) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_requirement_service` (`requirement_id`,`service_id`),
  KEY `idx_requirement_services_service_id` (`service_id`),
  CONSTRAINT `fk_requirement_services_requirement` FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_requirement_services_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `requirement_task_links` (
  `id` char(36) NOT NULL,
  `requirement_id` char(36) NOT NULL,
  `ai_employee_id` varchar(191) NOT NULL,
  `ai_employee_name` varchar(191) NOT NULL,
  `ai_employee_type` varchar(32) NOT NULL,
  `ai_task_assignment_id` varchar(191) NOT NULL,
  `task_title` varchar(255) NOT NULL,
  `project_id` char(36) NOT NULL,
  `service_id` char(36) DEFAULT NULL,
  `branch_name` varchar(191) DEFAULT NULL,
  `expected_outputs` json DEFAULT NULL,
  `priority` varchar(16) NOT NULL,
  `status` varchar(32) NOT NULL,
  `result_summary` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `idx_requirement_task_links_requirement_id` (`requirement_id`),
  KEY `idx_requirement_task_links_project_id` (`project_id`),
  KEY `idx_requirement_task_links_service_id` (`service_id`),
  CONSTRAINT `fk_requirement_task_links_requirement` FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_requirement_task_links_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
