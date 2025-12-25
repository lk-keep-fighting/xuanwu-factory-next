# ComboboxCreateNew 组件修复完成

## 问题描述
在服务详情页面的构建对话框中，当用户在分支搜索框输入自定义分支时，出现运行时错误：
```
TypeError: children is not a function
at ComboboxCreateNew (src/components/ui/shadcn-io/combobox/index.tsx:300:9)
```

## 根本原因
ComboboxCreateNew 组件期望接收 `onCreateNew` 属性，但在服务详情页面中错误地使用了 `onSelect` 属性。

## 修复方案
将 `src/app/projects/[id]/services/[serviceId]/page.tsx` 中的 ComboboxCreateNew 组件属性从 `onSelect` 改为 `onCreateNew`。

## 修复前代码
```tsx
<ComboboxCreateNew
  onSelect={(value) => {
    setBuildBranch(value)
    setBranchPickerOpen(false)
  }}
>
  {(inputValue) => `使用自定义分支: "${inputValue}"`}
</ComboboxCreateNew>
```

## 修复后代码
```tsx
<ComboboxCreateNew
  onCreateNew={(value) => {
    setBuildBranch(value)
    setBranchPickerOpen(false)
  }}
>
  {(inputValue) => `使用自定义分支: "${inputValue}"`}
</ComboboxCreateNew>
```

## 验证结果
✅ 所有测试通过
- onCreateNew 属性正确使用
- 不再使用错误的 onSelect 属性  
- children 函数正确传递
- 分支设置和对话框关闭逻辑正常

## 影响范围
- **文件**: `src/app/projects/[id]/services/[serviceId]/page.tsx`
- **功能**: 构建对话框中的自定义分支输入
- **用户体验**: 用户现在可以正常输入自定义分支名称进行构建

## 状态
✅ **已完成** - ComboboxCreateNew 组件错误已修复，用户可以正常使用自定义分支功能