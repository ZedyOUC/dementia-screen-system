# GitHub 提交与团队交接

## 提交范围

本目录是任务包 2 的后端交付物，建议作为团队仓库中的：

```text
backend/
```

应提交：

- `src/`
- `sql/`
- `cloud-functions/`
- `fixtures/` 中已经确认需要给后端联调的配置快照
- `scripts/`
- `docs/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.env.example`
- `README.md`

不要提交：

- `.env`
- `data/users.json`
- `data/files.json`
- `data/files/`
- 数据库密码、腾讯云 API 密钥、微信 AppSecret
- 真实患者资料和包含隐私的测试文件

## 推荐 Git 流程

在 `C:\Users\Lenovo\Desktop\gpt` 的 PowerShell 中执行：

```powershell
git clone https://github.com/Llj159-lab/dementia-screen-system.git
Set-Location .\dementia-screen-system
git switch -c task2-backend
```

先查看团队仓库是否已经有同名目录：

```powershell
Get-ChildItem -Force
Test-Path .\backend
```

如果仓库没有 `backend` 目录，再复制本目录；不要覆盖队友已经存在的 `backend` 目录：

```powershell
Copy-Item -Recurse -Path C:\Users\Lenovo\Desktop\gpt\backend -Destination .\backend
```

如果仓库已经有 `backend` 目录，应先和仓库维护者确认目录归属，再按文件逐项合并。

提交前检查：

```powershell
git status --short
git diff --check
git add backend
git diff --cached --stat
git diff --cached --name-only
git commit -m "feat(backend): add task 2 foundation services"
git push -u origin task2-backend
```

不要在没有检查 `git diff --cached --name-only` 的情况下提交。确认列表中没有 `.env`、`data/`、密码或患者资料。

## 如果不能直接推送

如果 `git push` 提示没有权限，说明你不是该仓库的写入成员。此时不要反复尝试主分支，改为：

1. Fork 团队仓库；
2. 在自己的 Fork 中推送 `task2-backend`；
3. 向团队仓库创建 Pull Request；
4. 请仓库维护者审核并合并。

## 发给团队的同步消息

提交或 Pull Request 创建后，把链接和下面这段话发到群里：

> 我已提交任务包 2 后端基础服务，分支为 `task2-backend`。内容包括 PostgreSQL 建表与验证 SQL、Web 登录与 Bearer Token 鉴权、RBAC、统一响应格式、文件上传/列表/元数据/下载接口、OpenAPI 文档和 CloudBase 健康检查函数脚手架。腾讯云环境 `ad-scd-dev-d1g1y08v5962945fd` 已创建 PostgreSQL 七张表、私有桶 `ad-scd-files` 和 `storage.objects` 的 authenticated 读取/上传策略。当前仍明确标记为待完成的是云函数实际部署、Node 后端真实连接云数据库/云存储和小程序真实登录。请任务包 1 提供最终量表配置，任务包 3 对接业务接口，任务包 4/5 联调登录和文件接口，任务包 7 按 `backend/docs/openapi.yaml` 做测试。

## 给不同同学的信息

- 任务包 1：量表编码、题目/选项/评分规则、来源页码；
- 任务包 3：数据库表名、鉴权方式、文件接口、统一响应结构；
- 任务包 4/5：登录接口、Bearer Token、文件接口和当前本地/云端边界；
- 任务包 7：OpenAPI 文档、测试账号、错误码和验收截图。
