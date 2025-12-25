# Jenkins Job路径修复说明

## 🎯 问题发现

用户指出Jenkins Job的实际路径包含文件夹前缀：
- **默认Job**: `CICD-STD/build-by-dockerfile`
- **Java JAR Job**: `CICD-STD/build-java-jar`

之前的代码只使用了Job名称`build-java-jar`，缺少了文件夹前缀`CICD-STD/`。

## ✅ 修复内容

### 1. 代码修复
**文件**: `src/app/api/services/[id]/build/route.ts`

**修改前**:
```typescript
jobName = 'build-java-jar'
```

**修改后**:
```typescript
jobName = 'CICD-STD/build-java-jar'
```

### 2. Jenkins路径处理
Jenkins客户端的`normalizeJobPath`方法会自动处理文件夹路径：
- 输入: `CICD-STD/build-java-jar`
- 转换为: `job/CICD-STD/job/build-java-jar`
- 最终URL: `{jenkins_url}/job/CICD-STD/job/build-java-jar/buildWithParameters`

### 3. 文档更新
更新了以下文档以反映正确的Job路径：
- `JENKINS_JOB_CREATION_GUIDE.md`
- `JAVA_JAR_BUILD_QUICK_FIX.md`

## 🔧 Jenkins Job创建要求

### 正确的Job结构
```
Jenkins
└── CICD-STD/ (文件夹)
    ├── build-by-dockerfile (现有Job)
    └── build-java-jar (新建Job)
```

### 创建步骤
1. 在Jenkins中进入`CICD-STD`文件夹
2. 创建名为`build-java-jar`的Pipeline Job
3. 完整路径将是`CICD-STD/build-java-jar`

## 📋 验证方法

### 1. 检查现有Job路径
在Jenkins中确认默认Job的完整路径：
```
CICD-STD/build-by-dockerfile
```

### 2. 创建新Job
在相同文件夹下创建Java JAR Job：
```
CICD-STD/build-java-jar
```

### 3. 测试调用
- 创建Java JAR类型服务
- 触发构建
- 应该不再出现404错误

## 🎯 预期结果

修复后的行为：
1. ✅ Java JAR服务调用正确的Job路径
2. ✅ 不再出现404错误
3. ✅ 如果Job不存在，仍会回退到默认Job
4. ✅ 保持与现有架构的一致性

## 📝 注意事项

1. **Job路径格式**: 必须使用`文件夹名/Job名`格式
2. **大小写敏感**: Jenkins路径区分大小写
3. **特殊字符**: 避免在Job名中使用特殊字符
4. **权限检查**: 确保Jenkins用户有访问该文件夹的权限

---

**总结**: 通过添加正确的文件夹前缀`CICD-STD/`，Java JAR构建现在应该能够找到正确的Jenkins Job路径。