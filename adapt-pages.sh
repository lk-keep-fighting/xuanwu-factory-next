#!/bin/bash

# 适配项目详情页
sed -i '' "1s/^/'use client'\n\n/" 'src/app/projects/[id]/page.tsx'
sed -i '' 's/import { useParams, useNavigate }/import { useParams, useRouter }/g' 'src/app/projects/[id]/page.tsx'
sed -i '' 's/import { useNavigate }/import { useRouter }/g' 'src/app/projects/[id]/page.tsx'
sed -i '' 's/const navigate = useNavigate()/const router = useRouter()/g' 'src/app/projects/[id]/page.tsx'
sed -i '' "s/navigate(/router.push(/g" 'src/app/projects/[id]/page.tsx'
sed -i '' 's/from react-router-dom/from next\/navigation/g' 'src/app/projects/[id]/page.tsx'

# 适配服务详情页
sed -i '' "1s/^/'use client'\n\n/" 'src/app/projects/[id]/services/[serviceId]/page.tsx'
sed -i '' 's/import { useParams, useNavigate }/import { useParams, useRouter }/g' 'src/app/projects/[id]/services/[serviceId]/page.tsx'
sed -i '' 's/const navigate = useNavigate()/const router = useRouter()/g' 'src/app/projects/[id]/services/[serviceId]/page.tsx'
sed -i '' "s/navigate(/router.push(/g" 'src/app/projects/[id]/services/[serviceId]/page.tsx'
sed -i '' 's/from react-router-dom/from next\/navigation/g' 'src/app/projects/[id]/services/[serviceId]/page.tsx'

# 适配 ServiceCreateForm
sed -i '' "1s/^/'use client'\n\n/" 'src/app/projects/components/ServiceCreateForm.tsx'

echo "✅ 页面适配完成"
