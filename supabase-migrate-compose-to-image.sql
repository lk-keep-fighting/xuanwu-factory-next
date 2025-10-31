-- 迁移脚本：将 compose 类型重命名为 image
-- 执行时间：请在 Supabase SQL Editor 中执行

-- 1. 删除旧的 CHECK 约束
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_type_check;

-- 2. 更新现有的 'compose' 类型数据为 'image'
UPDATE services SET type = 'image' WHERE type = 'compose';

-- 3. 添加新的 CHECK 约束（支持 application, database, image）
ALTER TABLE services ADD CONSTRAINT services_type_check 
CHECK (type IN ('application', 'database', 'image'));

-- 验证迁移结果
SELECT type, COUNT(*) as count FROM services GROUP BY type;
