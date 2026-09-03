# PostgreSQL 作业执行手册

## 结论

截图中的 PostgreSQL 数据库可以继续使用。当前后端原本是“集合定义”，本文件将它落成 PostgreSQL 表。作业不需要完成生产级多实例、正式域名、完整小程序登录或商业化部署。

本次最低可交付目标：

1. PostgreSQL 中成功创建 7 张表；
2. 后端保留健康检查、登录和 RBAC 接口；
3. 能证明后端使用的表结构与项目设计一致；
4. 把真实未完成项写清楚，不把本地文件模式冒充云端连接。

## 你现在在腾讯云控制台要做

1. 进入环境 `ad-scd-dev-d1g1y08v5962945fd`。
2. 打开你已经选择的 PostgreSQL 数据库，找到连接信息或 SQL 执行入口。
3. 如果控制台提供 SQL 编辑器，打开它。
4. 如果没有 SQL 编辑器，使用 PostgreSQL 客户端（例如 `psql`、DBeaver 或 pgAdmin）连接。
5. 执行 `backend/sql/001_init.sql` 的全部内容。
6. 检查是否出现以下 7 张表：
   - `users`
   - `patients`
   - `scale_configs`
   - `assessment_records`
   - `assessment_answers`
   - `files`
   - `operation_logs`
7. 也可以执行 `backend/sql/002_verify.sql`，预期返回 7 行表名。
8. 截一张“表已创建”的控制台截图，或复制表名列表给我。

不要把数据库密码发到聊天中，也不要把密码写进 Git 文件。

## 连接信息怎么放到本地

如果腾讯云提供标准 PostgreSQL 连接串，建议在本机创建 `backend/.env`：

```text
DATABASE_URL=postgresql://用户名:密码@主机:端口/数据库名
CLOUD_ENV_ID=ad-scd-dev-d1g1y08v5962945fd
```

当前代码还没有自动读取 `DATABASE_URL` 并执行查询。因此，设置这两个变量本身不等于后端已经连接云数据库。现阶段它们只用于准备下一步接入，健康接口仍可能显示本地模式。

## 作业演示建议

演示顺序可以是：

1. 展示数据库控制台中的 7 张表；
2. 展示 `backend/src/database/schema.ts` 与 `backend/sql/001_init.sql` 的对应关系；
3. 启动后端；
4. 调用 `GET /api/v1/health`；
5. 调用 `POST /api/v1/auth/web/login`；
6. 调用 `GET /api/v1/auth/me`；
7. 用研究者账号调用管理员接口，展示 `40301` 权限拒绝；
8. 说明真实云数据库驱动接入和小程序登录属于后续工作，当前作业交付不依赖它们。

## 云存储配置

PG 模式下建议创建一个私有 Bucket，例如 `ad-scd-files`，再在 Bucket 内使用两个对象路径前缀：

```text
scale-assets/
assessment-reports/
```

不要把本地后端的 `data/files` 当作云存储已经接入。当前本地接口仍使用本地文件适配器，云存储配置完成后还需要后端或云函数增加真实 CloudBase Storage 适配。

创建 Bucket 时建议：

- 访问权限打开“私有桶”；
- 作业演示可设置 20 MB 文件大小限制；
- 允许类型填写 `image/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`；
- 在 Bucket 内创建 `scale-assets` 和 `assessment-reports` 两个文件夹，或使用同名对象路径前缀；
- 不创建允许匿名读取或匿名上传的策略。

## 文件服务演示

文件服务目前有本地开发适配器，接口已经可以供两个前端联调。真实云存储尚未连接，因此演示时可以上传一张量表图片或一个小型报告文件，检查 `data/files.json` 和 `data/files/<fileId>/` 是否生成。

## 真实性边界

已由本地实际验证：

- SQL 文件已按现有 TypeScript 数据模型编写；
- 原有 TypeScript 类型检查通过；
- 原有逻辑集合校验通过；
- 本地登录、身份读取、权限拒绝和退出失效通过。

尚未由本地实际验证：

- 腾讯云 PostgreSQL 连接；
- SQL 在你的云环境中的实际执行；
- 云函数部署；
- 云存储；
- 微信小程序真实身份登录。
