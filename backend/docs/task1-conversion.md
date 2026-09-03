# 任务包 1 资料转换结果

## 来源

来源是 `_incoming/ad-ouc-master` 压缩包中的 `scoring/config_data.py`、评分实现和 SQL 文件。压缩包中确实包含任务包 1 的成果，不只是原始量表 PDF。

## 已转换

- `fixtures/task1-scale-configs.json`：6 个量表的后端配置 JSON；
- `sql/004_seed_scale_configs.sql`：写入现有 PostgreSQL `scale_configs` 表的种子 SQL；
- `scripts/convert_task1_assets.py`：可重复执行的转换脚本。

转换时保留了：

- 量表编码、名称和版本；
- 指导语；
- 题目编码、题号、题干、认知域；
- 选项编码、显示文本、分值、NA 标记；
- 计分类型、总分范围、界值和备注；
- 来源 PDF 文件名；
- 原评分算法 Python 文件路径。

转换统计：6 个量表、94 道题、245 个选项、13 条界值。

## 如何导入腾讯云 PostgreSQL

你已经创建的 7 张表不需要删除或重建。在 PostgreSQL SQL 编辑器中执行：

1. `sql/004_seed_scale_configs.sql`；
2. 使用下面的查询验证 6 条配置是否进入数据库：

```sql
SELECT scale_code, version, status,
       jsonb_array_length(items) AS item_count,
       jsonb_array_length(scoring->'cutoffs') AS cutoff_count
FROM scale_configs
ORDER BY scale_code;
```

预期返回 6 行，题目总数为 94，界值总数为 13。由于配置尚未由团队共同确认，生成的 `status` 暂设为 `draft`。

## 没有转换成什么

- 没有把任务包 1 的 Python 评分算法偷偷改写成 TypeScript；
- 没有把医学阈值标记为已经由医生确认；
- 没有把刺激图片凭空写入数据库，当前源配置没有给出独立资产清单；
- 没有执行腾讯云 SQL，执行动作仍需要你在控制台完成。

任务包 1 的 Python 评分引擎仍然是独立成果，后续由任务包 3 通过约定的评分调用方式接入业务接口。
