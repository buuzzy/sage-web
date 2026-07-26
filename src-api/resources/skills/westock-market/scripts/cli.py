#!/usr/bin/env python3
"""
westock-market — 腾讯市场总览 CLI
支持：热搜股票、热门板块、新股日历、投资日历、股票搜索
"""

import sys
import json
import argparse
import urllib.request
import urllib.error

API_KEY = "30fc4280ff39cf4caa1c909cc8778af5ed6f3de82e6ff5b4768d4906ca079f0e"
BASE_QQ = "https://proxy.finance.qq.com"
QUERY = f"?app=openclaw&token={API_KEY}&skill_channel=stockclaw"


def parse_args():
    parser = argparse.ArgumentParser(description="腾讯市场总览数据查询")
    parser.add_argument("--route", "-r", required=True,
                        choices=["hot-stocks", "hot-boards", "ipo", "calendar", "search", "watchlist"],
                        help="路由类型")
    parser.add_argument("--query", "-q", default="",
                        help="搜索关键词（search用）")
    parser.add_argument("--date", "-d", default="",
                        help="日期 YYYY-MM-DD（calendar用）")
    parser.add_argument("--country", default="1",
                        help="国家：1=中国, 2=美国, 3=港股（calendar用）")
    parser.add_argument("--type", default="1",
                        help="事件类型：1=经济数据, 2=央行, 3=重大事件, 4=休市（calendar用）")
    parser.add_argument("--market", default="hs",
                        help="市场：hs=沪深, hk=港股（ipo用）")
    parser.add_argument("--count", default="20",
                        help="返回数量")
    return parser.parse_args()


def get_url(url):
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())
    with opener.open(url, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    args = parse_args()

    try:
        if args.route == "hot-stocks":
            url = f"{BASE_QQ}/ifzqgtimg/appstock/app/HotStock/getHotStockDetail{QUERY}"
            result = get_url(url)
            print(json.dumps({"success": True, "route": "hot-stocks", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "hot-boards":
            url = f"{BASE_QQ}/ifzqgtimg/appstock/app/board/index{QUERY}"
            result = get_url(url)
            print(json.dumps({"success": True, "route": "hot-boards", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "ipo":
            url = (f"{BASE_QQ}/ifzqfinance/stock/notice/ipo/search{QUERY}"
                   f"&market={args.market}&period=90&detail=1")
            result = get_url(url)
            print(json.dumps({"success": True, "route": "ipo", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "calendar":
            if args.date:
                url = (f"{BASE_QQ}/ifzqgtimg/appstock/app/FinanceCalendar/query{QUERY}"
                       f"&date={args.date}&limit=30&country={args.country}&type={args.type}")
            else:
                url = f"{BASE_QQ}/ifzqgtimg/appstock/app/FinanceCalendar/getActive{QUERY}"
            result = get_url(url)
            print(json.dumps({"success": True, "route": "calendar", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "search":
            if not args.query:
                print(json.dumps({"success": False, "error": "--query 必填"}, ensure_ascii=False))
                sys.exit(1)
            url = (f"{BASE_QQ}/cgi/cgi-bin/smartbox/search{QUERY}"
                   f"&query={urllib.parse.quote(args.query)}&stockFlag=1&fundFlag=0&ptFlag=1")
            import urllib.parse
            url = (f"{BASE_QQ}/cgi/cgi-bin/smartbox/search{QUERY}"
                   f"&query={urllib.parse.quote(args.query)}&stockFlag=1&fundFlag=1&ptFlag=1")
            result = get_url(url)
            print(json.dumps({"success": True, "route": "search", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "watchlist":
            url = (f"{BASE_QQ}/cgi/cgi-bin/watchlist/rank{QUERY}"
                   f"&count={args.count}&sort_type=updateTime")
            result = get_url(url)
            print(json.dumps({"success": True, "route": "watchlist", "data": result}, ensure_ascii=False, indent=2))

    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(json.dumps({"success": False, "error": f"HTTP {e.code}: {e.reason}", "detail": body}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
