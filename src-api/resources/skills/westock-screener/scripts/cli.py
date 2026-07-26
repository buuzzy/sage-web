#!/usr/bin/env python3
"""
westock-screener — 腾讯条件选股与宏观数据 CLI
支持：条件筛选选股、指数/板块成份股、宏观数据
"""

import sys
import json
import argparse
import urllib.request
import urllib.error

API_KEY = "30fc4280ff39cf4caa1c909cc8778af5ed6f3de82e6ff5b4768d4906ca079f0e"
PROXY_URL = f"https://proxy.finance.qq.com/cgi/cgi-bin/openai/openclaw/proxy?app=openclaw&token={API_KEY}&skill_channel=stockclaw"


def parse_args():
    parser = argparse.ArgumentParser(description="腾讯条件选股与宏观数据查询")
    parser.add_argument("--route", "-r", required=True,
                        choices=["filter", "list"],
                        help="路由：filter=条件选股, list=列表数据(成份股/宏观)")
    parser.add_argument("--expression", "-e", default="TotalMV > 0",
                        help="筛选表达式（filter用），如 \"intersect([ClosePrice = PriceCeiling, PriceCeiling > 0])\"")
    parser.add_argument("--fields", "-f",
                        default="SecuCode,StockName,ClosePrice,ChangePCT,TurnoverRate,PE_TTM,TotalMV",
                        help="返回字段，逗号分隔（filter用）")
    parser.add_argument("--list-codes", "-l", default="",
                        help="列表代码，逗号分隔（list用），如 macro_cpi_ppi 或 industry_list_sw1")
    parser.add_argument("--date", "-d", default="",
                        help="查询日期 YYYY-MM-DD（默认今日）")
    parser.add_argument("--limit", default="50",
                        help="筛选结果上限（filter用，默认50）")
    return parser.parse_args()


def post_proxy(route, params):
    payload = {"token": API_KEY, "route": route, "params": params}
    req = urllib.request.Request(
        PROXY_URL,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def build_fields(fields_str):
    """将逗号分隔的字段字符串转换为 fields 数组"""
    field_names = {
        "SecuCode": "代码", "StockName": "名称", "ClosePrice": "最新价",
        "ChangePCT": "涨跌幅%", "TurnoverRate": "换手率%", "PE_TTM": "PE-TTM",
        "PB": "市净率", "TotalMV": "总市值", "CircMV": "流通市值",
        "ROE_TTM": "ROE", "MA_5": "MA5", "MA_10": "MA10", "MA_20": "MA20",
        "RSI_6": "RSI6", "MACD": "MACD", "PriceCeiling": "涨停价", "PriceFloor": "跌停价"
    }
    return [{"metric": f.strip(), "name": field_names.get(f.strip(), f.strip())}
            for f in fields_str.split(",") if f.strip()]


def main():
    args = parse_args()

    try:
        import datetime
        date = args.date if args.date else datetime.date.today().strftime("%Y-%m-%d")

        if args.route == "filter":
            result = post_proxy("stock_filter_query", {
                "selector": {
                    "expression": args.expression,
                    "date": date,
                    "limit": int(args.limit)
                },
                "fields": build_fields(args.fields)
            })
            print(json.dumps({"success": True, "route": "filter", "expression": args.expression, "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "list":
            if not args.list_codes:
                print(json.dumps({"success": False, "error": "--list-codes 必填，如 macro_cpi_ppi 或 industry_list_sw1"}, ensure_ascii=False))
                sys.exit(1)
            list_codes = [c.strip() for c in args.list_codes.split(",") if c.strip()]
            result = post_proxy("query_list_data_by_date", {
                "list_codes": list_codes,
                "date": date
            })
            # 自动解析 list_data 字符串为 JSON 对象
            if isinstance(result, dict) and "data" in result:
                data = result.get("data", {}).get("data", {})
                for code in list_codes:
                    if code in data and "list_data" in data[code]:
                        try:
                            data[code]["list_data"] = json.loads(data[code]["list_data"])
                        except Exception:
                            pass
            print(json.dumps({"success": True, "route": "list", "list_codes": list_codes, "data": result}, ensure_ascii=False, indent=2))

    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(json.dumps({"success": False, "error": f"HTTP {e.code}: {e.reason}", "detail": body}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
