---
name: westock-research
description: 研报与资讯数据：个股研报列表、公告查询、公告正文、市场资讯新闻
promptDescription: 研报与资讯：个股研报列表、公告查询、公告正文、市场资讯新闻
whenToUse: 研报,研究报告,机构报告,公告,年报,季报,分红公告,增发,重组,新闻,资讯,市场新闻,财经新闻,公告正文,全文
---

# 研报与资讯数据查询

## 调用方式

使用预装 CLI 脚本，API Key 已内置：

```bash
python3 ~/.sage/skills/westock-research/scripts/cli.py --route <reports|report-list|notices|notice-content|news> [参数]
```

## 路由一：个股研报 `--route reports`

```bash
python3 ~/.sage/skills/westock-research/scripts/cli.py -r reports -s sh600519
```

参数：`-s` 股票代码

返回字段：id 研报ID, title 标题, time 发布时间, src 来源机构, tzpj 投资评级, summary 摘要

## 路由二：精选研报 `--route report-list`

```bash
python3 ~/.sage/skills/westock-research/scripts/cli.py -r report-list
```

返回字段：id, title 标题, preview 摘要, publish_time 发布时间, img 封面图

## 路由三：公告列表 `--route notices`

```bash
python3 ~/.sage/skills/westock-research/scripts/cli.py -r notices -s sh600519 --notice-type 0
```

参数：`-s` 股票代码, `--notice-type` 0=全部 1=财务 2=配股 3=增发 4=股权变动 5=重大事项

返回字段：id 公告ID, title 标题, time 时间, type 类型

## 路由四：公告正文 `--route notice-content`

```bash
python3 ~/.sage/skills/westock-research/scripts/cli.py -r notice-content --notice-id nos1225062336
```

返回：detail(纯文本) 或 pdf(PDF链接)

## 路由五：市场资讯 `--route news`

```bash
python3 ~/.sage/skills/westock-research/scripts/cli.py -r news -s sh000001
```

参数：`-s` 指数代码（sh000001 上证, sz399001 深证, hkHSI 恒生）

返回字段：time 时间, title 标题, src 来源, importance 重要程度(0普通/1重要), summary 摘要

## 输出规范

查到数据后，用 `canvas:html` 代码块输出可视化画布（右侧面板自动展示），对话区只写文字分析。
