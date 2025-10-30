-- 为 projects 表新增 identifier 字段并保证唯一性
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS identifier TEXT;

-- 为现有数据填充默认的唯一编号（基于 ID 截断）
UPDATE projects
SET identifier = CONCAT('project-', SUBSTR(id::TEXT, 1, 8))
WHERE identifier IS NULL OR identifier = '';

-- 设置约束：不能为空且唯一
ALTER TABLE projects
ALTER COLUMN identifier SET NOT NULL;

ALTER TABLE projects
ADD CONSTRAINT IF NOT EXISTS projects_identifier_unique UNIQUE (identifier);
