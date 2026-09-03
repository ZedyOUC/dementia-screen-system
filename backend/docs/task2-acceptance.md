# 任务包 2 验收记录

更新时间：2026-09-03

## 已完成且有证据

- [x] CloudBase 环境 ID 已提供：`ad-scd-dev-d1g1y08v5962945fd`
- [x] PostgreSQL 中已创建 7 张表；用户提供控制台结果截图，返回了全部表名
- [x] 私有存储桶已创建：`ad-scd-files`
- [x] `storage.objects` 已创建已登录用户读取策略：`ad_scd_authenticated_read`
- [x] `storage.objects` 已创建已登录用户上传策略：`ad_scd_authenticated_upload`
- [x] 本地 Web 登录、Bearer Token、退出登录和 RBAC 已实际验证
- [x] 本地文件上传、列表、元数据和下载已实际验证
- [x] 统一响应格式、`X-Request-Id` 和 OpenAPI 文档已提供
- [x] 云函数健康检查脚手架已通过本地 Node.js smoke test

## 仍未完成或未被本工作区验证

- [ ] 云函数健康检查已在 CloudBase 控制台实际部署并调用
- [ ] Node.js 后端已通过 `DATABASE_URL` 实际连接 CloudBase PostgreSQL
- [ ] Node.js 后端已实际使用 CloudBase 云存储，而不是本地 `data/files`
- [ ] 微信小程序真实登录和身份校验
- [ ] 云存储策略是否严格区分不同角色和评估报告访问范围
- [ ] 团队开发权限是否已配置并验证
- [ ] 云函数日志、运行监控和失败告警截图

## 提交原则

GitHub 中提交本目录的代码、SQL、云函数脚手架、接口文档和验收记录。
不要提交 `.env`、数据库密码、云 API 密钥、`data/users.json`、
`data/files.json`、本地上传文件或真实患者资料。
