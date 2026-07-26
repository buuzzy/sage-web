#!/usr/bin/env python3
"""
westock-research — 腾讯研报与资讯 CLI
支持：个股研报、精选研报、公告列表、公告正文、市场资讯
"""

import sys
import json
import argparse
import urllib.request
import urllib.error

API_KEY = "30fc4280ff39cf4caa1c909cc8778af5ed6f3de82e6ff5b4768d4906ca079f0e"
PROXY_URL = f"https://proxy.finance.qq.com/cgi/cgi-bin/openai/openclaw/proxy?app=openclaw&token={API_KEY}&skill_channel=stockclaw"
BASE_QQ = "https://proxy.finance.qq.com"
BASE_IFZQ = "http://ifzq.gtimg.cn"
QUERY = f"?app=openclaw&token={API_KEY}&skill_channel=stockclaw"


def parse_args():
    parser = argparse.ArgumentParser(description="腾讯研报与资讯查询")
    parser.add_argument("--route", "-r", required=True,
                        choices=["reports", "report-list", "notices", "notice-content", "news"],
                        help="路由：reports=个股研报, report-list=精选研报, notices=公告列表, notice-content=公告正文, news=市场资讯")
    parser.add_argument("--symbol", "-s", default="",
                        help="股票代码，如 sh600519（reports/notices/news用）")
    parser.add_argument("--notice-id", default="",
                        help="公告ID（notice-content用）")
    parser.add_argument("--notice-type", default="0",
                        help="公告类型：0=全部,1=财务,2=配股,3=增发,4=股权变动,5=重大事项（notices用）")
    parser.add_argument("--page", default="1", help="页码")
    parser.add_argument("--limit", "-l", default="10", help="每页数量")
    parser.add_argument("--reports-only", action="store_true",
                        help="仅返回真实研报（过滤掉新闻资讯，id不以resSN开头的条目）")
    return parser.parse_args()


def get_url_redirect(url):
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())
    with opener.open(url, timeout=30) as resp:
        return json.loads(resp.read())


def get_url(url):
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read())


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


def main():
    args = parse_args()

    try:
        if args.route == "reports":
            if not args.symbol:
                print(json.dumps({"success": False, "error": "--symbol 必填"}, ensure_ascii=False))
                sys.exit(1)
            url = (f"{BASE_IFZQ}/appstock/app/investRate/getReport{QUERY}"
                   f"&symbol={args.symbol}&page={args.page}&n={args.limit}&withConference=1")
            result = get_url_redirect(url)
            # 可选：过滤掉 resSN 开头的新闻资讯，只保留真实券商研报
            if args.reports_only and isinstance(result, dict):
                data_block = result.get("data", {}).get("data", [])
                if isinstance(data_block, list):
                    result["data"]["data"] = [r for r in data_block if not r.get("id", "").startswith("resSN")]
            print(json.dumps({"success": True, "route": "reports", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "report-list":
            result = post_proxy("research_report_list_get", {
                "page": int(args.page),
                "size": int(args.limit),
                "type": 1
            })
            print(json.dumps({"success": True, "route": "report-list", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "notices":
            if not args.symbol:
                print(json.dumps({"success": False, "error": "--symbol 必填"}, ensure_ascii=False))
                sys.exit(1)
            url = (f"{BASE_IFZQ}/appstock/news/noticeList/searchByType{QUERY}"
                   f"&symbol={args.symbol}&noticeType={args.notice_type}&page={args.page}&n={args.limit}")
            result = get_url_redirect(url)
            print(json.dumps({"success": True, "route": "notices", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "notice-content":
            if not args.notice_id:
                print(json.dumps({"success": False, "error": "--notice-id 必填"}, ensure_ascii=False))
                sys.exit(1)
            url = (f"{BASE_QQ}/ifzqgtimg/appstock/news/content/content{QUERY}"
                   f"&id={args.notice_id}")
            result = get_url(url)
            print(json.dumps({"success": True, "route": "notice-content", "data": result}, ensure_ascii=False, indent=2))

        elif args.route == "news":
            symbol = args.symbol if args.symbol else "sh000001"
            url = (f"{BASE_IFZQ}/appstock/news/info/search{QUERY}"
                   f"&symbol={symbol}&type=2&n={args.limit}&page={args.page}")
            result = get_url_redirect(url)
            print(json.dumps({"success": True, "route": "news", "data": result}, ensure_ascii=False, indent=2))

    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(json.dumps({"success": False, "error": f"HTTP {e.code}: {e.reason}", "detail": body}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
