-- 项目管理系统数据库初始化脚本

-- 1. 创建 projects 表
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  identifier TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建 services 表
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('application', 'database', 'image')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'stopped', 'error', 'building')),
  
  -- 通用配置
  env_vars JSONB,
  resource_limits JSONB,
  volumes JSONB,
  
  -- 网络配置（Kubernetes Service）
  network_config JSONB,
  
  -- Application 特定字段（基于源码构建）
  git_provider TEXT CHECK (git_provider IN ('github', 'gitlab', 'bitbucket', 'gitea') OR git_provider IS NULL),
  git_repository TEXT,
  git_branch TEXT,
  git_path TEXT,
  build_type TEXT CHECK (build_type IN ('dockerfile', 'nixpacks', 'buildpacks') OR build_type IS NULL),
  dockerfile_path TEXT,
  build_args JSONB,
  port INTEGER,
  replicas INTEGER,
  command TEXT,
  auto_deploy BOOLEAN DEFAULT false,
  built_image TEXT,
  
  -- Database 特定字段（内置数据库镜像）
  database_type TEXT CHECK (database_type IN ('mysql', 'redis', 'postgresql', 'mongodb', 'mariadb') OR database_type IS NULL),
  version TEXT,
  external_port INTEGER,
  username TEXT,
  password TEXT,
  root_password TEXT,
  database_name TEXT,
  volume_size TEXT,
  internal_host TEXT,
  internal_connection_url TEXT,
  
  -- 镜像服务特定字段（基于现有镜像）
  image TEXT,
  tag TEXT,
  health_check JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建 deployments 表
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'building', 'success', 'failed')),
  build_logs TEXT,
  image_tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(type);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_deployments_service_id ON deployments(service_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);

-- 5. 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 为 projects 表创建触发器
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 services 表创建触发器
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 插入示例数据（可选）
-- INSERT INTO projects (name, description) VALUES 
--   ('示例项目', '这是一个示例项目'),
--   ('玄武工厂', '生产环境项目');

-- 7. 授予权限（根据实际情况调整）
-- GRANT ALL ON projects TO anon, authenticated;
-- GRANT ALL ON services TO anon, authenticated;
-- GRANT ALL ON deployments TO anon, authenticated;
