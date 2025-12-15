# ComboboxCreateNew 修复

## 🚨 问题描述

点击构建在分支搜索框输入时报错：
```
TypeError: children is not a function
at ComboboxCreateNew (src/components/ui/shadcn-io/combobox/index.tsx:300:9)
```

## 🔍 问题原因

`ComboboxCreateNew` 组件期望 `children` 是一个函数，但我们传递的是字符串：

```tsx
// ❌ 错误用法
<ComboboxCreateNew onSelect={handleSelect}>
  使用自定义分支: "{branchSearch}"  // 字符串
</ComboboxCreateNew>
```

组件内部会调用 `children(inputValue)`，导致 `"字符串"(inputValue)` 报错。

## ✅ 修复方案

将字符串改为函数形式：

```tsx
// ✅ 正确用法
<ComboboxCreateNew onSelect={handleSelect}>
  {(inputValue) => `使用自定义分支: "${inputValue}"`}  // 函数
</ComboboxCreateNew>
```

## 🔧 具体修改

**文件**: `src/app/projects/[id]/services/[serviceId]/page.tsx`

```tsx
// 修复前
<ComboboxCreateNew
  onSelect={(value) => {
    setBuildBranch(value)
    setBranchPickerOpen(false)
  }}
>
  使用自定义分支: "{branchSearch}"
</ComboboxCreateNew>

// 修复后
<ComboboxCreateNew
  onSelect={(value) => {
    setBuildBranch(value)
    setBranchPickerOpen(false)
  }}
>
  {(inputValue) => `使用自定义分支: "${inputValue}"`}
</ComboboxCreateNew>
```

## 🎯 修复效果

- ✅ 修复运行时 TypeError
- ✅ 分支搜索框正常工作
- ✅ 自定义分支创建功能可用
- ✅ 正确显示用户输入的分支名

## 🚀 使用流程

1. 点击构建按钮 → 打开构建对话框
2. 点击分支选择器 → 显示分支列表
3. 输入自定义分支名 → 显示"使用自定义分支: xxx"
4. 点击该选项 → 分支名设置完成
5. 配置其他参数并开始构建

现在分支搜索和自定义分支功能可以正常使用了！