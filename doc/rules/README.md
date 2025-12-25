# 数据库迁移操作
- 使用 npx prisma migrate dev --name xxx 进行安全的schema变更
- 避免使用 --force-reset 等危险命令
- 变更前先备份数据库