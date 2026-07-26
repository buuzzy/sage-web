---
name: westock-quote
description: 实时行情快照、历史K线、技术指标、资金流向、筹码成本、股东结构、ETF详情、机构评级、龙虎榜、大宗交易、融资融券、业绩预告、分红解禁等事件数据
promptDescription: 行情数据：实时价格、K线历史、技术指标、资金流向、筹码、股东、ETF详情
whenToUse: 股价,行情,现价,涨跌,K线,日K,周K,均线,MACD,KDJ,RSI,布林线,技术指标,资金流向,主力,筹码,股东,ETF净值,ETF规模,机构评级,目标价,一致预期,龙虎榜,大宗交易,融资融券,业绩预告,分红,解禁,回购
---

# 行情数据查询

## 调用方式

使用预装 CLI 脚本查询，API Key 已内置，无需额外配置：

```bash
python3 ~/.sage/skills/westock-quote/scripts/cli.py --route <snapshot|history|minute> [参数]
```

## 股票代码格式

| 市场 | 前缀 | 示例 |
|------|------|------|
| 上海A股 | `sh` | `sh600519` |
| 深圳A股 | `sz` | `sz000001` |
| 港股 | `hk` | `hk00700` |
| 美股 | `us` | `usNVDA`（符号大写）|
| ETF | `sh/sz` | `sh510300` |

海外指数：`hkHSI`(恒生) `usIXIC`(纳指) `usSPX`(标普)

## 路由一：实时行情快照 `--route snapshot`

```bash
python3 ~/.sage/skills/westock-quote/scripts/cli.py -r snapshot -c "sh600519,sh000001" -f "ClosePrice,Change,ChangeRatio,OpenPrice,HighPrice,LowPrice,PrevClosePrice"
```

参数：`-c` 股票代码(逗号分隔)，`-f` 字段(逗号分隔)

### 常用 fields

**价格**：ClosePrice 最新价, OpenPrice 开盘, HighPrice 最高, LowPrice 最低, PrevClosePrice 昨收, Change 涨跌额, ChangeRatio 涨跌幅

**技术指标**：MA_5, MA_10, MA_20, MACD, KDJ_K/D/J, RSI_6, RSI_12, BOLL_UPPER, BOLL_LOWER

**筹码**：ChipAvgCost 平均成本, ChipConcentration90 集中度, ChipProfitRate 收益率

**资金流向**(需 -d 日期)：MainNetFlow 主力净流入, JumboNetFlow 超大单净流入

**公司**：CompanyName 全称, MainBusiness 主营, SW1Name 行业

**机构评级**：TargetPriceAvg 目标价, RatingBuyCnt 买入数, RatingCnt 总评级数

**股东**：Top10Shareholder 十大股东, Top10FloatShareholder 十大流通股东

**ETF**：EtfNav 净值, EtfSize 规模, EtfTrackIndexName 跟踪指数

## 路由二：历史K线 `--route history`

```bash
python3 ~/.sage/skills/westock-quote/scripts/cli.py -r history --code sh600519 --start-date 2026-01-01 --end-date 2026-07-26
```

参数：`--code` 单个股票代码, `--start-date`/`--end-date` 日期范围, `--ktype` day/week/month

默认返回字段：OpenPrice, ClosePrice, HighPrice, LowPrice, TurnoverVolume, TurnoverAmount

## 路由三：分时数据 `--route minute`

```bash
python3 ~/.sage/skills/westock-quote/scripts/cli.py -r minute --code sh600519
```

## 输出规范

查到数据后，用 `canvas:html` 代码块输出可视化画布（右侧面板自动展示），对话区只写文字分析。
