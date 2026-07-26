---
name: westock-screener
description: 条件选股筛选（涨停/跌停/估值/技术）、指数板块成份查询、宏观经济数据（GDP/CPI/PMI/M2等）
promptDescription: 股票筛选：条件选股（涨停/跌停/估值/技术），指数板块成份，宏观数据（GDP/CPI/PMI）
whenToUse: 选股,筛选,涨停,跌停,停牌,涨幅,估值,PE,PB,ROE,板块成份,申万,指数成份,沪股通,深股通,宏观,GDP,CPI,PPI,PMI,M2,货币供应,社融,工业利润,社会消费
---

# 条件选股与宏观数据查询

## 调用方式

使用预装 CLI 脚本，API Key 已内置：

```bash
python3 ~/.sage/skills/westock-screener/scripts/cli.py --route <filter|list> [参数]
```

## 路由一：条件选股 `--route filter`

```bash
python3 ~/.sage/skills/westock-screener/scripts/cli.py -r filter -e "intersect([ChangePCT > 5, ChangePCT <= 7])"
```

参数：`-e` 筛选表达式, `-f` 返回字段(逗号分隔, 可选)

### expression 语法示例

| 表达式 | 说明 |
|--------|------|
| `intersect([ClosePrice = PriceCeiling, PriceCeiling > 0])` | 涨停股 |
| `intersect([ClosePrice = PriceFloor, PriceFloor > 0])` | 跌停股 |
| `intersect([ChangePCT > 5, ChangePCT <= 7])` | 涨幅5-7% |
| `intersect([PE_TTM > 0, PE_TTM < 15, ROE_TTM > 15])` | 低估值高ROE |
| `intersect([RSI_6 < 30])` | RSI超卖 |
| `intersect([Ifsuspend = 1])` | 停牌股 |

### 默认返回字段

SecuCode 代码, StockName 名称, ClosePrice 价格, ChangePCT 涨幅, TurnoverRate 换手率, PE_TTM, TotalMV 市值

## 路由二：列表/宏观数据 `--route list`

```bash
python3 ~/.sage/skills/westock-screener/scripts/cli.py -r list -l "macro_cpi_ppi"
```

参数：`-l` 列表代码(逗号分隔), `-d` 查询日期(可选)

### 常用 list_codes

**宏观数据**：
- `macro_cpi_ppi` - CPI/PPI同比
- `macro_gdp` - GDP同比
- `macro_pmi` - PMI制造业/非制造
- `macro_fundquantity` - M0/M1/M2货币供应
- `macro_consumption` - 社会消费
- `macro_core_indicatros_cur` - 核心宏观全景

**指数/板块**：
- `index_list` - 有行情指数清单
- `industry_list_sw1` - 申万一级行业
- `industry_list_sw2` - 申万二级行业
- `sh_connected_stocks` - 沪股通成份
- `sz_connected_stocks` - 深股通成份

## 输出规范

查到数据后，用 `canvas:html` 代码块输出可视化画布（右侧面板自动展示），对话区只写文字分析。
