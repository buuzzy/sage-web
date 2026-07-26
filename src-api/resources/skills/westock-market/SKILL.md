---
name: westock-market
description: 市场总览数据：热搜股票、热门板块排行、新股日历、投资日历经济事件、股票搜索、股单排行
promptDescription: 市场总览：热搜股票、热门板块排行、新股日历、投资日历经济事件、股票搜索
whenToUse: 热门,热搜,热股,今日热点,板块排行,涨幅榜,板块资金,新股,打新,IPO,上市日历,投资日历,经济数据,央行,财经日历,大事,搜索股票,查股票代码,股票搜索,北向,北向热门,换手率排行,股单排行,热门股单
---

# 市场总览数据查询

## 调用方式

使用预装 CLI 脚本，API Key 已内置：

```bash
python3 ~/.sage/skills/westock-market/scripts/cli.py --route <hot-stocks|hot-boards|ipo|calendar|search|watchlist> [参数]
```

## 路由一：热搜股票 `--route hot-stocks`

```bash
python3 ~/.sage/skills/westock-market/scripts/cli.py -r hot-stocks
```

返回字段：code 股票代码, name 名称, zdf 涨跌幅, zxj 最新价

## 路由二：热门板块 `--route hot-boards`

```bash
python3 ~/.sage/skills/westock-market/scripts/cli.py -r hot-boards
```

返回：行业板块/概念板块/地域板块的涨跌幅、换手率、量比排名，及板块资金流向

板块字段：bd_name 板块名, bd_zdf 涨跌幅, bd_zdf5 5日涨幅, bd_hsl 换手率, nzg_name 领涨股

## 路由三：新股日历 `--route ipo`

```bash
python3 ~/.sage/skills/westock-market/scripts/cli.py -r ipo
```

返回字段：symbol 代码, name 名称, price 发行价, syl 市盈率, ssrq 上市日期, sgdm 申购代码

## 路由四：投资日历 `--route calendar`

```bash
python3 ~/.sage/skills/westock-market/scripts/cli.py -r calendar --date 2026-07-26 --country 1 --type 1
```

参数：`--date` 日期, `--country` 1=中国 2=美国 3=港股, `--type` 1=经济数据 2=央行 3=重大事件 4=休市

返回字段：time 时间, Weightiness 重要程度(1-3), CountryName 国家, FinancialEvent 事件, Previous 前值, Predict 预测值, CurrentValue 实际值

## 路由五：股票搜索 `--route search`

```bash
python3 ~/.sage/skills/westock-market/scripts/cli.py -r search -q "贵州茅台"
```

## 路由六：热门股单 `--route watchlist`

```bash
python3 ~/.sage/skills/westock-market/scripts/cli.py -r watchlist
```

## 输出规范

查到数据后，用 `canvas:html` 代码块输出可视化画布（右侧面板自动展示），对话区只写文字分析。
