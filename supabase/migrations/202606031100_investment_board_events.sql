-- 投资看板事件表（v1 硬编码 3 类事件：财报发布 / 除权除息 / 大涨大跌）
CREATE TABLE IF NOT EXISTS investment_board_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('earnings_report', 'dividend', 'big_move')),
  related_code TEXT NOT NULL,
  related_name TEXT,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  payload     JSONB DEFAULT '{}'::jsonb,
  priority    INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_iboard_user_priority ON investment_board_events(user_id, priority DESC, scheduled_at);
CREATE INDEX idx_iboard_user_code    ON investment_board_events(user_id, related_code);

-- RLS：用户只能读自己的看板事件
ALTER TABLE investment_board_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own board events"
  ON investment_board_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own board events"
  ON investment_board_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own board events"
  ON investment_board_events FOR DELETE
  USING (auth.uid() = user_id);
