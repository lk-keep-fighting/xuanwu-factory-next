-- 为 services 表添加 network_config 字段
-- 用于配置 Kubernetes Service 的网络访问

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS network_config JSONB;

-- 添加注释说明字段用途
COMMENT ON COLUMN services.network_config IS 'Kubernetes Service 网络配置，包含 container_port, service_port, service_type, node_port, protocol';

-- 为了向后兼容，将现有的 port 和 ports 字段迁移到 network_config
-- 注意：这是可选的迁移脚本，如果有现有数据需要保留

-- 迁移 Application 服务的 port 字段
UPDATE services 
SET network_config = jsonb_build_object(
  'container_port', port,
  'service_port', port,
  'service_type', 'ClusterIP',
  'protocol', 'TCP'
)
WHERE type = 'application' 
  AND port IS NOT NULL 
  AND network_config IS NULL;

-- 迁移 Database 服务的 port 字段
UPDATE services 
SET network_config = jsonb_build_object(
  'container_port', port,
  'service_port', port,
  'service_type', 'ClusterIP',
  'protocol', 'TCP'
)
WHERE type = 'database' 
  AND port IS NOT NULL 
  AND network_config IS NULL;

-- 迁移镜像服务的 ports 字段（取第一个端口）
UPDATE services 
SET network_config = jsonb_build_object(
  'container_port', (ports->0->>'container_port')::INTEGER,
  'service_port', COALESCE((ports->0->>'host_port')::INTEGER, (ports->0->>'container_port')::INTEGER),
  'service_type', 'ClusterIP',
  'protocol', COALESCE(ports->0->>'protocol', 'TCP')
)
WHERE type = 'image' 
  AND ports IS NOT NULL 
  AND jsonb_array_length(ports) > 0
  AND network_config IS NULL;
