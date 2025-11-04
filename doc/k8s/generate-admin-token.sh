#!/usr/bin/env bash
# ==============================================
# 玄武工厂平台 - Kubernetes 管理员 Token 生成脚本
# ==============================================
# 此脚本可直接在 Kubernetes 集群的 master 节点运行，
# 用于创建具备 cluster-admin 权限的 ServiceAccount 并
# 输出可用于部署的访问凭证。

set -Eeuo pipefail

SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-xuanwu-factory-admin}
NAMESPACE=${NAMESPACE:-xuanwu-factory}
CLUSTER_ROLE=${CLUSTER_ROLE:-cluster-admin}
TOKEN_DURATION=${TOKEN_DURATION:-8760h} # 365 天
CLUSTER_NAME=${CLUSTER_NAME:-xuanwu-factory-cluster}
CONTEXT_NAME=${CONTEXT_NAME:-xuanwu-factory-context}
USER_NAME=${USER_NAME:-xuanwu-factory-admin}

log() {
  printf '\n➡️  %s\n' "$1"
}

err() {
  printf '\n❌ %s\n' "$1" >&2
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "未检测到命令: $1"
    exit 1
  fi
}

decode_base64() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import sys, base64; data = sys.stdin.read(); sys.stdout.write(base64.b64decode(data).decode("utf-8"))'
  else
    base64 --decode 2>/dev/null || base64 -d
  fi
}

encode_base64() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import sys, base64; data = sys.stdin.buffer.read(); sys.stdout.write(base64.b64encode(data).decode("utf-8"))'
  else
    base64 | tr -d '\n'
  fi
}

require_command kubectl

log "当前 kubectl 上下文: $(kubectl config current-context 2>/dev/null || echo '未知')"

# 确认命名空间存在
if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  log "命名空间 $NAMESPACE 不存在，正在创建..."
  kubectl create namespace "$NAMESPACE"
else
  log "命名空间 $NAMESPACE 已存在"
fi

log "创建 ServiceAccount ${SERVICE_ACCOUNT_NAME} 并绑定 ${CLUSTER_ROLE} 权限..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${SERVICE_ACCOUNT_NAME}
  namespace: ${NAMESPACE}
  labels:
    app: xuanwu-factory
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${SERVICE_ACCOUNT_NAME}-${CLUSTER_ROLE}
  labels:
    app: xuanwu-factory
    managed-by: xuanwu-factory
subjects:
- kind: ServiceAccount
  name: ${SERVICE_ACCOUNT_NAME}
  namespace: ${NAMESPACE}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ${CLUSTER_ROLE}
EOF

log "生成 ServiceAccount Token..."
TOKEN=$(kubectl -n "$NAMESPACE" create token "$SERVICE_ACCOUNT_NAME" --duration="$TOKEN_DURATION" 2>/dev/null || true)

if [ -z "$TOKEN" ]; then
  log "集群版本不支持 kubectl create token，尝试从 Secret 中读取..."
  SECRET_NAME=$(kubectl get secret -n "$NAMESPACE" \
    -o jsonpath="{range .items[?(@.type=='kubernetes.io/service-account-token')]}{.metadata.name}{'\\n'}{end}" \
    | grep "^${SERVICE_ACCOUNT_NAME}-token" | head -n 1 || true)

  if [ -z "$SECRET_NAME" ]; then
    err "未找到 ${SERVICE_ACCOUNT_NAME} 对应的 Token Secret"
    exit 1
  fi

  TOKEN=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data.token}' | decode_base64)
fi

if [ -z "$TOKEN" ]; then
  err "未能生成 ServiceAccount Token"
  exit 1
fi

API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null || true)
CA_DATA=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' 2>/dev/null || true)

if [ -z "$API_SERVER" ]; then
  err "未能获取当前集群的 API Server 地址，请确认 kubectl 已连接到目标集群"
  exit 1
fi

if [ -z "$CA_DATA" ]; then
  log "未获取到集群 CA 证书，将默认启用 TLS 校验跳过 (K8S_SKIP_TLS_VERIFY=true)"
  SKIP_TLS_VERIFY="true"
else
  SKIP_TLS_VERIFY="false"
fi

KUBECONFIG_CONTENT=$(
  cat <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: ${API_SERVER}
$(if [ -n "$CA_DATA" ]; then
  printf '    certificate-authority-data: %s\n' "$CA_DATA"
else
  printf '    insecure-skip-tls-verify: true\n'
fi)
  name: ${CLUSTER_NAME}
contexts:
- context:
    cluster: ${CLUSTER_NAME}
    user: ${USER_NAME}
  name: ${CONTEXT_NAME}
current-context: ${CONTEXT_NAME}
preferences: {}
users:
- name: ${USER_NAME}
  user:
    token: ${TOKEN}
EOF
)

KUBECONFIG_BASE64=$(printf '%s' "$KUBECONFIG_CONTENT" | encode_base64)

cat <<EOF

============================================
✅ 已生成具备管理员权限的 Kubernetes Token
--------------------------------------------
ServiceAccount: ${NAMESPACE}/${SERVICE_ACCOUNT_NAME}
API Server    : ${API_SERVER}
Token 有效期  : ${TOKEN_DURATION}
============================================

▶  Token（可直接用于环境变量或 Bearer 认证）
${TOKEN}

▶  建议写入 Secret(stringData) 的键值
K8S_API_SERVER: "${API_SERVER}"
K8S_BEARER_TOKEN: "${TOKEN}"
K8S_CA_CERT_DATA: "${CA_DATA}"
K8S_SKIP_TLS_VERIFY: "${SKIP_TLS_VERIFY}"

▶  KUBECONFIG_DATA（YAML）
${KUBECONFIG_CONTENT}

▶  KUBECONFIG_DATA Base64（可直接粘贴到 Secret.data 中）
${KUBECONFIG_BASE64}

使用方法建议：
1. 将上述键值添加到 xuanwu-factory-secret 的 stringData 中；
2. 重新执行 kubectl apply -f k8s-deployment.yaml；
3. 应用启动后，可通过 /api/k8s/health 接口验证权限是否生效。

EOF
