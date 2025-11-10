# 数据库变更操作说明

本文档记录在本项目中执行数据库结构变更（Prisma schema 更改 / 迁移）的推荐流程、命令、验证、以及回滚与注意事项，便于团队成员和 CI 在安全、可追溯的流程下操作。

> 适用范围：使用 Prisma + MySQL 的项目（参见 `prisma/schema.prisma`）。

## 总览

主要步骤：
1. 在本地修改 `prisma/schema.prisma`（添加/修改 model、index、map 等）。
2. 在本地生成迁移（`prisma migrate dev`）并在本地或开发库上验证。将 `prisma/migrations` 提交到代码仓库。 
3. 在 CI/生产环境执行 `prisma migrate deploy` 或由管理员在目标环境安全执行迁移。
4. 在迁移前后执行验证、备份、并在出现问题时执行回滚或补救步骤。

以下分章节详细说明每一步的命令与注意事项。

---

## 前提条件

- 确保 `DATABASE_URL` 在执行命令的环境中可用且能连通目标数据库。
- 执行迁移的账号需具备创建/修改表与索引的权限（CREATE、ALTER 等）。
- 生产环境操作前请做好备份（例如 mysqldump）。
- 在团队中使用迁移文件（`prisma/migrations`）能保证可追溯性与复现性，请不要在生产仅使用 `prisma db push`（除非经过评估）。

---

## 本地开发：生成迁移并验证（推荐）

1. 安装依赖（若尚未）

```bash
pnpm install
# 或 npm install
```

2. 确保 `DATABASE_URL` 可用（本地开发通常使用 `.env` 或 `.env.local`）

```bash
# 复制 .env.local -> .env（若你使用 .env.local 管理本地变量）
cp .env.local .env
# 或在 shell 导出临时变量
export DATABASE_URL="mysql://user:pass@host:3306/dbname"
```

3. 生成迁移并在本地数据库上应用（交互式，会打开编辑器以确认）

```bash
npx prisma migrate dev --name your-change-name
```

- 上述命令会：
  - 对比 `prisma/schema.prisma` 并生成迁移 SQL 到 `prisma/migrations/YYYYMMDDHHMMSS_your-change-name`。
  - 将迁移应用到 `DATABASE_URL` 指定的数据库（通常是本地 dev DB）。
  - 运行 `prisma generate` 生成客户端。

4. 本地验证：

- 使用 `prisma studio` 或 SQL 客户端检查表结构与数据是否正常：

```bash
npx prisma studio
```

- 运行应用中的相关操作（单元/集成测试或手动接口调用）以确保变更无回归。

5. 提交迁移文件和 schema 变更

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "prisma: add migration - your-change-name"
git push
```

---

## 生产 / CI：部署迁移（非交互式）

在 CI 或生产环境中不要使用 `migrate dev`。推荐流程：

1. CI 环境中安装依赖并 `prisma generate`（可选）
2. 在 CI 或运维机器上运行：

```bash
# 在 CI 中（需有 DATABASE_URL 作为 secret）
npx prisma migrate deploy
```

- `migrate deploy` 会按 `prisma/migrations` 中的顺序把未应用的迁移依次执行。
- 如果没有迁移文件（团队没有跟踪迁移），可评估使用 `prisma db push`，但这不会生成迁移文件，且不易回滚或审计。

---

## 快速修复 / 非迁移方式（仅限开发、或无法生成迁移时）

- `prisma db push` 将会把 `schema.prisma` 的定义直接推送到数据库，创建或修改表结构：

```bash
npx prisma db push
```

- 风险：不会生成迁移文件；在多人或生产环境中不推荐长期使用。

---

## 备份与回滚策略

1. 备份
- 在执行生产迁移前，务必备份数据库：

```bash
mysqldump -h host -u user -p password --databases dbname > backup-$(date +%F-%T).sql
```

- 对于大型 DB，使用备份工具（逻辑或物理备份）和/或快照（云提供商）以保证恢复窗口。

2. 回滚
- 如果迁移失败或出现问题，优先用备份回滚（restore）：

```bash
mysql -h host -u user -p password dbname < backup-file.sql
```

- 如果迁移是可逆的（例如你写了 Down SQL），可在极少数场景下执行手动回滚 SQL。但 Prisma 的迁移机制并不自动生成 Down 脚本，谨慎使用。

3. 灾难恢复演练
- 定期在测试环境演练迁移/回滚流程，保证团队熟悉步骤并确认备份有效。

---

## 验证步骤（迁移后）

- 检查迁移状态：

```bash
npx prisma migrate status --schema=prisma/schema.prisma
```

- 使用 SQL 客户端或 `SHOW TABLES;`、`DESCRIBE table;` 确认表与列已按预期创建。
- 运行关键业务路径（API 调用、后台任务）以确认没有回归。
- 检查应用日志是否有 Prisma / DB 报错。

---

## CI / K8s 集成注意事项

- 在 CI 中把 `DATABASE_URL` 注入为 secret，不要在仓库中存储明文凭据。
- 生产环境执行迁移应在 CI 的 Deployment 阶段或由运维在受控环境运行：
  - 在 CI 中：`npx prisma migrate deploy`（确保 `prisma/migrations` 在仓库中且 CI 使用正确的 DATABASE_URL）。
  - 如果你的应用以容器化部署，请确保迁移在应用实例启动并接受流量前执行（init container 或 CI job）。

示例 GitHub Actions 步骤：

```yaml
- uses: actions/checkout@v4
- name: Install dependencies
  run: pnpm install --frozen-lockfile
- name: Apply DB migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: npx prisma migrate deploy
- name: Build and push image
  run: ...
```

---

## 迁移失败时的调试小贴士

- 常见错误：`P1012`（schema validate）、`P1001`（数据库连接失败）、权限错误、SQL 语法/约束冲突。
- 若 `P1012`（schema 验证）：请先运行 `npx prisma validate` 或检查 `schema.prisma` 是否语法正确。
- 若连接失败：确认 `DATABASE_URL`、网络、用户权限。
- 若因为缺少表或字段报错（运行时）：通常因为没有把迁移成功应用到生产 DB，执行 `npx prisma migrate status` 做核查。

---

## 逐步示例（将新增 `ServiceImage` 模型并部署到生产）

1. 修改 `prisma/schema.prisma`（添加模型）。
2. 本地运行：
```bash
# 复制 env 并确认能连 DB
cp .env.local .env
npx prisma migrate dev --name add-service-image
# 本地验证无误后提交迁移
git add prisma/schema.prisma prisma/migrations
git commit -m "prisma: add ServiceImage model"
git push
```
3. CI/生产：
```bash
# 在 CI: 安装依赖 -> apply migrations
npx prisma migrate deploy
```
4. 验证应用日志与业务流程。

---

## 额外建议

- 把 `prisma/migrations` 加入版本控制并在 Pull Request 里一起审查 schema 与生成的 SQL。
- 在 PR 模式下使用 `npx prisma migrate dev` 或 `prisma format` 做本地验证，避免语法错误造成 CI 失败。
- 考虑在迁移后运行自动化 smoke tests（关键 API 的简单请求）作为最终验证步骤。

---

如需，我可以：

- 创建 `scripts/init-db.sh` 或 `scripts/apply-migrations.sh` 自动化上面步骤并提交；
- 在仓库添加 `prisma/README.md`，说明团队如何编写 schema、命名迁移、以及常见约定；
- 帮你把一个 GitHub Actions 的示例 workflow 文件加入 `.github/workflows/migrate.yml` 以示范 CI 中如何安全地部署迁移。

你想先要哪一项自动化（脚本 / CI workflow / README）？
