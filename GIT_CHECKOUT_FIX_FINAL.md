# Git Checkout修复 - 支持分支和标签

## 🚨 问题描述

构建时拉取指定分支 `1.0.1.1` 报错：
```
ERROR: Couldn't find any revision to build. 
Verify the repository and branch configuration for this job.
ERROR: Maximum checkout retry attempts reached, aborting
```

## 🔍 问题分析

### 根本原因
1. **分支名格式错误**: Jenkins Git插件需要 `*/branch-name` 格式，而不是直接的 `branch-name`
2. **标签识别问题**: `1.0.1.1` 看起来像Git标签而不是分支，但脚本只尝试分支checkout
3. **缺少回退机制**: 没有标签checkout的回退逻辑

### 错误日志分析
```
> git rev-parse origin/1.0.1.1^{commit} # timeout=10
> git rev-parse 1.0.1.1^{commit} # timeout=10
ERROR: Couldn't find any revision to build.
```

Git无法找到名为 `1.0.1.1` 的分支，因为它实际上是一个标签。

## ✅ 修复方案

### 1. 修正分支checkout格式
```groovy
// 修复前 (错误)
checkout([$class: 'GitSCM', branches: [[name: branch]], ...])

// 修复后 (正确)
checkout([$class: 'GitSCM', branches: [[name: "*/${branch}"]], ...])
```

### 2. 添加标签checkout回退机制
```groovy
try {
  // 首先尝试作为分支checkout
  checkout([$class: 'GitSCM', 
    branches: [[name: "*/${branch}"]], 
    userRemoteConfigs: [[url: repo, credentialsId: env.GIT_CREDENTIALS]]
  ])
  echo "Successfully checked out branch: ${branch}"
} catch (Exception branchError) {
  echo "Failed to checkout branch '${branch}', trying as tag..."
  try {
    // 如果分支checkout失败，尝试作为标签
    checkout([$class: 'GitSCM', 
      branches: [[name: "refs/tags/${branch}"]], 
      userRemoteConfigs: [[url: repo, credentialsId: env.GIT_CREDENTIALS]]
    ])
    echo "Successfully checked out tag: ${branch}"
  } catch (Exception tagError) {
    // 两种方式都失败，提供详细错误信息
    echo "Failed to checkout both branch and tag '${branch}'"
    echo "Branch error: ${branchError.message}"
    echo "Tag error: ${tagError.message}"
    error "Could not checkout '${branch}' as either branch or tag. Please verify the branch/tag name exists in the repository."
  }
}
```

## 🔧 技术实现

### Jenkins脚本修改 (`doc/jenkins/脚本/build-template`)
```groovy
stage('Checkout') {
  steps {
    script {
      def repo = params.GIT_REPOSITORY?.trim()
      def branch = params.GIT_BRANCH?.trim() ?: 'main'
      
      if (!repo) {
        error 'Missing GIT_REPOSITORY parameter'
      }

      echo "Checking out ${repo} @ ${branch}"
      
      // 智能checkout：支持分支和标签
      try {
        checkout([$class: 'GitSCM', 
          branches: [[name: "*/${branch}"]], 
          userRemoteConfigs: [[url: repo, credentialsId: env.GIT_CREDENTIALS]]
        ])
        echo "Successfully checked out branch: ${branch}"
      } catch (Exception branchError) {
        echo "Failed to checkout branch '${branch}', trying as tag..."
        try {
          checkout([$class: 'GitSCM', 
            branches: [[name: "refs/tags/${branch}"]], 
            userRemoteConfigs: [[url: repo, credentialsId: env.GIT_CREDENTIALS]]
          ])
          echo "Successfully checked out tag: ${branch}"
        } catch (Exception tagError) {
          echo "Failed to checkout both branch and tag '${branch}'"
          echo "Branch error: ${branchError.message}"
          echo "Tag error: ${tagError.message}"
          error "Could not checkout '${branch}' as either branch or tag. Please verify the branch/tag name exists in the repository."
        }
      }
    }
  }
}
```

## 📊 Git引用格式说明

### Jenkins Git插件支持的引用格式

| 类型 | 格式 | 示例 | 说明 |
|------|------|------|------|
| 任意远程分支 | `*/branch-name` | `*/main`, `*/feature/auth` | 匹配所有远程仓库的指定分支 |
| 特定远程分支 | `origin/branch-name` | `origin/main`, `origin/develop` | 指定远程仓库的分支 |
| 标签 | `refs/tags/tag-name` | `refs/tags/v1.0.0`, `refs/tags/1.0.1.1` | Git标签的完整引用路径 |
| 提交哈希 | `commit-hash` | `a1b2c3d4e5f6...` | 特定的提交哈希 |

## 🚀 使用场景

### 场景1: 正常分支构建
```
输入: branch = "main"
执行: checkout(branches: [[name: "*/main"]])
结果: ✅ 成功checkout分支
日志: "Successfully checked out branch: main"
```

### 场景2: 标签构建 (修复目标)
```
输入: branch = "1.0.1.1"
执行: 
  1. 尝试 checkout(branches: [[name: "*/1.0.1.1"]]) → 失败
  2. 尝试 checkout(branches: [[name: "refs/tags/1.0.1.1"]]) → 成功
结果: ✅ 成功checkout标签
日志: "Failed to checkout branch '1.0.1.1', trying as tag..."
      "Successfully checked out tag: 1.0.1.1"
```

### 场景3: 不存在的引用
```
输入: branch = "nonexistent"
执行:
  1. 尝试分支checkout → 失败
  2. 尝试标签checkout → 失败
结果: ❌ 构建终止
日志: "Could not checkout 'nonexistent' as either branch or tag"
```

## 🎯 修复效果

### 修复前
- ❌ 只支持分支checkout
- ❌ 分支格式错误 (缺少 `*/` 前缀)
- ❌ 标签构建失败
- ❌ 错误信息不明确

### 修复后
- ✅ 智能识别分支和标签
- ✅ 正确的Git引用格式
- ✅ 自动回退机制
- ✅ 详细的错误日志
- ✅ 支持版本标签构建

## 📈 扩展建议

### 1. 前端分支选择器增强
```typescript
interface GitReference {
  name: string
  type: "branch" | "tag"
  default?: boolean
  commit?: {
    shortId: string
    title: string
  }
}

// 在UI中区分分支和标签
<ComboboxItem value={ref.name}>
  <div className="flex items-center justify-between">
    <span>{ref.name}</span>
    <div className="flex gap-1">
      {ref.type === "tag" && <Badge variant="outline">标签</Badge>}
      {ref.default && <Badge variant="secondary">默认</Badge>}
    </div>
  </div>
</ComboboxItem>
```

### 2. API增强支持标签
考虑在分支API中同时返回分支和标签：
```http
GET /api/services/{serviceId}/references?type=all
```

### 3. 构建历史标识
在构建历史中显示是从分支还是标签构建：
```json
{
  "metadata": {
    "git_ref_type": "tag",
    "git_ref_name": "1.0.1.1"
  }
}
```

## 🎉 总结

Git checkout修复已完成，现在系统可以：

- 🌿 **智能识别**: 自动区分分支和标签
- 🔄 **自动回退**: 分支失败时尝试标签checkout
- 📝 **详细日志**: 清晰的成功和错误信息
- 🎯 **精确构建**: 支持版本标签的精确构建

**特别解决了 `1.0.1.1` 这类版本标签的构建问题！**

用户现在可以使用任何有效的Git分支名或标签名进行构建，系统会自动处理不同类型的Git引用。