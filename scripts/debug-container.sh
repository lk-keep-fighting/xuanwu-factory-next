#!/bin/bash

# ===================================
# 容器调试快捷脚本
# ===================================

set -e

NAMESPACE="xuanwu-factory"
DEPLOYMENT="xuanwu-factory-next"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
容器调试快捷脚本

用法: $0 [命令]

命令:
  shell           进入容器 shell（使用内置工具）
  debug           注入 busybox 调试容器
  netshoot        注入 netshoot 网络调试容器（推荐）
  ubuntu          注入 Ubuntu 调试容器（完整工具集）
  logs            查看实时日志
  status          查看 Pod 状态和事件
  port-forward    端口转发到本地（3000 和 3001）
  top             查看资源使用情况
  env             查看环境变量
  network-test    网络连通性测试
  process-info    查看进程信息
  help            显示此帮助信息

示例:
  $0 shell              # 进入容器
  $0 netshoot           # 使用 netshoot 进行网络调试
  $0 logs               # 查看日志
  $0 port-forward       # 转发端口到本地

EOF
}

# 检查 kubectl 是否可用
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl 未安装或不在 PATH 中"
        exit 1
    fi
}

# 检查 Pod 是否存在
check_pod() {
    if ! kubectl get deployment -n "$NAMESPACE" "$DEPLOYMENT" &> /dev/null; then
        print_error "Deployment $DEPLOYMENT 在命名空间 $NAMESPACE 中不存在"
        exit 1
    fi
}

# 进入容器 shell
enter_shell() {
    print_info "进入容器 shell..."
    kubectl exec -it -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- sh
}

# 注入 busybox 调试容器
debug_busybox() {
    print_info "注入 busybox 调试容器..."
    print_warning "这将创建一个临时调试容器，共享主容器的进程命名空间"
    kubectl debug -it -n "$NAMESPACE" \
        deployment/"$DEPLOYMENT" \
        --image=busybox:latest \
        --target="$DEPLOYMENT" \
        --share-processes
}

# 注入 netshoot 调试容器
debug_netshoot() {
    print_info "注入 netshoot 网络调试容器..."
    print_warning "netshoot 包含完整的网络调试工具集"
    kubectl debug -it -n "$NAMESPACE" \
        deployment/"$DEPLOYMENT" \
        --image=nicolaka/netshoot \
        --target="$DEPLOYMENT"
}

# 注入 Ubuntu 调试容器
debug_ubuntu() {
    print_info "注入 Ubuntu 调试容器..."
    print_warning "这将创建一个完整的 Ubuntu 环境，可以安装任何工具"
    kubectl debug -it -n "$NAMESPACE" \
        deployment/"$DEPLOYMENT" \
        --image=ubuntu:22.04 \
        --target="$DEPLOYMENT" \
        --share-processes
}

# 查看日志
view_logs() {
    print_info "查看实时日志（Ctrl+C 退出）..."
    kubectl logs -f -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=100
}

# 查看状态
view_status() {
    print_info "查看 Pod 状态..."
    kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT"
    
    echo ""
    print_info "查看最近事件..."
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -20
    
    echo ""
    print_info "查看 Deployment 详情..."
    kubectl describe deployment -n "$NAMESPACE" "$DEPLOYMENT"
}

# 端口转发
port_forward() {
    print_info "端口转发到本地..."
    print_success "Next.js: http://localhost:3000"
    print_success "WebSocket: ws://localhost:3001"
    print_warning "按 Ctrl+C 停止转发"
    kubectl port-forward -n "$NAMESPACE" deployment/"$DEPLOYMENT" 3000:3000 3001:3001
}

# 查看资源使用
view_top() {
    print_info "查看资源使用情况..."
    kubectl top pod -n "$NAMESPACE" -l app="$DEPLOYMENT"
}

# 查看环境变量
view_env() {
    print_info "查看环境变量..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- env | sort
}

# 网络连通性测试
network_test() {
    print_info "执行网络连通性测试..."
    
    echo ""
    print_info "1. 测试内部健康检查..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- curl -f http://localhost:3000/api/health || print_error "健康检查失败"
    
    echo ""
    print_info "2. 测试 WebSocket 端口..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- nc -zv localhost 3001 || print_error "WebSocket 端口不可达"
    
    echo ""
    print_info "3. 测试数据库连接..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- nc -zv 192.168.154.154 3306 || print_error "数据库连接失败"
    
    echo ""
    print_info "4. 测试 Jenkins 连接..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- curl -f -s -o /dev/null -w "%{http_code}" http://192.168.44.121 || print_error "Jenkins 连接失败"
    
    echo ""
    print_success "网络测试完成"
}

# 查看进程信息
process_info() {
    print_info "查看进程信息..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- ps aux
    
    echo ""
    print_info "查看监听端口..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- netstat -tulpn 2>/dev/null || \
        print_warning "netstat 不可用，尝试使用 ss..."
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- ss -tulpn 2>/dev/null || \
        print_warning "ss 也不可用"
}

# 主函数
main() {
    check_kubectl
    check_pod
    
    case "${1:-help}" in
        shell)
            enter_shell
            ;;
        debug)
            debug_busybox
            ;;
        netshoot)
            debug_netshoot
            ;;
        ubuntu)
            debug_ubuntu
            ;;
        logs)
            view_logs
            ;;
        status)
            view_status
            ;;
        port-forward|pf)
            port_forward
            ;;
        top)
            view_top
            ;;
        env)
            view_env
            ;;
        network-test|net)
            network_test
            ;;
        process-info|ps)
            process_info
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
