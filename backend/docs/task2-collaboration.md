# 任务包 2：后端基础服务协作边界

## 你的主责

你只需要对以下内容负责：

1. 后端项目能启动；
2. 数据库表结构和字段说明；
3. 登录、当前用户、退出登录；
4. 角色权限判断；
5. 健康检查；
6. 与前端约定接口格式；
7. 与量表/评分同学对接量表配置字段。

不需要把系统做到上市级别，也不需要在本次作业中完成高可用、容灾、正式域名、支付、完整运维监控等内容。

## 需要和谁协作

### 1. 前端同学

你要交给前端：

- 后端地址，例如 `http://localhost:3000`；
- 登录接口：`POST /api/v1/auth/web/login`；
- 当前用户接口：`GET /api/v1/auth/me`；
- 退出接口：`POST /api/v1/auth/logout`；
- 请求头格式：`Authorization: Bearer <token>`；
- 统一返回字段：`code`、`message`、`data`、`requestId`；
- 权限失败时使用 `40101` 或 `40301`。
- 文件接口规范见 `docs/openapi.yaml`，本地联调上传体使用 `contentBase64`。

你要向前端确认：

- 登录页使用用户名密码，还是只演示固定账号；
- 前端是否需要研究者和评估者两个角色；
- 前端希望使用本地地址还是腾讯云地址。

可直接发给前端：

> 我负责后端基础服务。目前已提供 `/api/v1/auth/web/login`、`/api/v1/auth/me`、`/api/v1/auth/logout` 和 `/api/v1/system/admin-check`。登录成功后把 `data.token` 放到 `Authorization: Bearer <token>`，所有响应读取 `code/message/data/requestId`。当前作业阶段使用本地后端，云端接入状态会单独说明。

前端联调文件接口：

> 上传使用 `POST /api/v1/files`，需要 `file:upload`。请求体包含 `originalName`、`mimeType`、`relatedType`、`relatedId`、`contentBase64`。下载使用 `GET /api/v1/files/{fileId}/download`，需要 `file:read`。

### 2. 量表内容/评分同学

你需要向他们索取：

- 每个量表的机器编码，例如 `SCD_Q9`、`MOCA_B`、`CDR`、`ADAS_COG`；
- 版本号；
- 题目编码和题目顺序；
- 选项编码及分值；
- 指导语；
- 图片或刺激材料文件名；
- 评分公式、分项分数和总分；
- 哪些规则已经由老师确认，哪些仍待确认。

你不能自己猜临床阈值。你只负责把他们确认后的内容保存到 `scale_configs.items`、`scale_configs.instructions` 和 `scale_configs.scoring`。

可直接发给量表/评分同学：

> 请按“量表编码、版本号、题目编码、选项与分值、评分公式、异常判断规则、来源页码”提供最终版配置。没有确认的临床阈值请标为待确认，我不会在后端自行补写。

### 3. 负责腾讯云控制台或部署的同学

如果不是你负责云控制台，需要他们提供：

- PostgreSQL 连接地址、端口、数据库名、用户名；
- 不要在群里发送密码；
- 云环境 ID：`ad-scd-dev-d1g1y08v5962945fd`；
- 是否能执行 SQL；
- 是否需要通过云函数访问数据库；
- 云存储名称和上传权限方案。

你要交给他们：

- `backend/sql/001_init.sql`；
- `backend/docs/postgres-assignment-runbook.md`；
- `backend/docs/openapi.yaml`；
- 7 张表的名称；
- 你已经验证过的本地接口。

可直接发给部署同学：

> 我已完成后端逻辑模型和 PostgreSQL 建表脚本，请在环境 `ad-scd-dev-d1g1y08v5962945fd` 执行 `backend/sql/001_init.sql`，并只回传表创建结果和非敏感连接参数，密码不要发群里。

### 4. 测试与系统文档同学

你要交给测试同学：

- `docs/openapi.yaml`；
- Web 登录测试账号；
- 文件上传、列表、元数据、下载接口；
- `40101`、`40301`、`40001`、`40002`、`40401` 的预期场景；
- PostgreSQL 七张表已创建的截图。

请测试同学重点验证：

- 未登录访问受保护接口是否返回 `40101`；
- 研究者访问管理员接口是否返回 `40301`；
- 合法图片或 PDF 能上传并下载；
- 非法 MIME 类型、空文件和不存在的文件能被拒绝；
- 每个响应是否包含 `code`、`message`、`data`、`requestId`。

可直接发给测试同学：

> 后端基础接口已经可以联调。请按 `docs/openapi.yaml` 验证登录、鉴权、RBAC、文件上传/下载和统一响应格式，并记录每个失败用例的 `requestId`。当前云函数、云存储和小程序真实登录仍标记为待配置，不要把它们写成已通过。

## 你最终可以在汇报中说

> 我负责任务包 2 的后端基础服务，完成了用户、患者、量表配置、评估记录、答案、文件元数据和操作日志 7 张表的设计，并提供了 PostgreSQL 建表脚本。后端实现了统一响应、健康检查、用户名密码登录、Bearer Token、退出登录和基于角色的权限检查。临床量表的具体评分规则由量表/评分同学确认后配置，未确认的医学阈值不由后端自行推断。
