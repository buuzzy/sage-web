-- ============================================================
-- Sage 投资对讲机 v2：用户自选股表
-- ============================================================
-- 数据源决策：用户对讲机说「加比亚迪自选 / 跟住腾讯」→ DeepSeek 意图分类为
-- watchlist_add → 写入本表。前端用「自选 / 持仓」双 Tab 展示。
-- 行情每次拉时由 mobile-watchlist service 串行调 westock + 60s 内存缓存。

CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,         -- 完整代码：HK.00700 / SH.600519 / US.AAPL
  name        TEXT NOT NULL,         -- 中文名：腾讯控股
  market      TEXT NOT NULL,         -- HK / SH / SZ / US / NASDAQ / NYSE
  currency    TEXT,                  -- HKD / CNY / USD
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  source      TEXT DEFAULT 'voice' CHECK (source IN ('voice', 'manual', 'system')),
  UNIQUE (user_id, code)
);

COMMENT ON TABLE  public.user_watchlist            IS 'iOS 投资对讲机的自选股列表，按 user_id 隔离。';
COMMENT ON COLUMN public.user_watchlist.code       IS '完整代码（含市场前缀），如 HK.00700。';
COMMENT ON COLUMN public.user_watchlist.source     IS 'voice = 对讲机自然语言加入；manual = 主动搜索加入；system = 系统推荐。';

CREATE INDEX IF NOT EXISTS user_watchlist_user_added_idx
  ON public.user_watchlist (user_id, added_at DESC);

-- RLS：每个用户只能管理自己的自选
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_watchlist_self_all" ON public.user_watchlist;
CREATE POLICY "user_watchlist_self_all"
  ON public.user_watchlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
