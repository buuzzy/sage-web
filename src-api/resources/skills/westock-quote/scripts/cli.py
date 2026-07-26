#!/usr/bin/env python3
"""
westock-quote — 腾讯行情数据查询 CLI
支持：实时快照、历史K线、分时数据
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error

API_KEY = "30fc4280ff39cf4caa1c909cc8778af5ed6f3de82e6ff5b4768d4906ca079f0e"
PROXY_URL = f"https://proxy.finance.qq.com/cgi/cgi-bin/openai/openclaw/proxy?app=openclaw&token={API_KEY}&skill_channel=stockclaw"
BASE_QQ = "https://proxy.finance.qq.com"


def parse_args():
    parser = argparse.ArgumentParser(description="腾讯行情数据查询")
    parser.add_argument("--route", "-r", required=True,
                        choices=["snapshot", "history", "minute"],
                        help="路由：snapshot=实时快照, history=历史K线, minute=分时")
    parser.add_argument("--codes", "-c", default="",
                        help="股票代码，逗号分隔，如 sh600519,sz000001（snapshot用）")
    parser.add_argument("--code", default="",
                        help="单个股票代码（history/minute用）")
    parser.add_argument("--fields", "-f", default="ClosePrice,Change,ChangeRatio,OpenPrice,HighPrice,LowPrice,PrevClosePrice,TurnoverVolume,TurnoverAmount,TurnoverRate,TotalMV",
                        help="快照字段，逗号分隔")
    parser.add_argument("--start-date", default="",
                        help="K线开始日期 YYYY-MM-DD")
    parser.add_argument("--end-date", default="",
                        help="K线结束日期 YYYY-MM-DD")
    parser.add_argument("--ktype", default="day",
                        choices=["day", "week", "month"],
                        help="K线类型（默认day）")
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


def get_url(url):
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    args = parse_args()

    try:
        if args.route == "snapshot":
            if not args.codes:
                print(json.dumps({"success": False, "error": "--codes 必填"}, ensure_ascii=False))
                sys.exit(1)
            result = post_proxy("stock_quote_snapshot", {
                "codes": args.codes,
                "fields": args.fields
            })
            print(json.dumps({"success": True, "route": "snapshot", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "history":
            if not args.code:
                print(json.dumps({"success": False, "error": "--code 必填"}, ensure_ascii=False))
                sys.exit(1)
            params = {
                "code": args.code,
                "fields": "OpenPrice,ClosePrice,HighPrice,LowPrice,TurnoverVolume,TurnoverAmount"
            }
            if args.start_date:
                params["start_date"] = args.start_date
            if args.end_date:
                params["end_date"] = args.end_date
            if args.ktype != "day":
                params["ktype"] = args.ktype
            result = post_proxy("stock_quote_history", params)
            print(json.dumps({"success": True, "route": "history", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "minute":
            if not args.code:
                print(json.dumps({"success": False, "error": "--code 必填"}, ensure_ascii=False))
                sys.exit(1)
            url = (f"{BASE_QQ}/ifzqgtimg/appstock/app/minute/query"
                   f"?app=openclaw&token={API_KEY}&skill_channel=stockclaw"
                   f"&code={args.code}&p=1")
            result = get_url(url)
            print(json.dumps({"success": True, "route": "minute", "data": result}, ensure_ascii=False, indent=2))

    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(json.dumps({"success": False, "error": f"HTTP {e.code}: {e.reason}", "detail": body}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
