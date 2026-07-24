-- ============================================================
-- Sage 投资对讲机 v2：行动卡阅后即焚生命周期
-- ============================================================
-- 配合 cron 任务（src-api/src/jobs/scheduler.ts 每天 02:30）：
--   * 当天未处理（pending_review / awaiting_confirmation） → 归档进 group_key='archived'
--   * 归档 48h 后（即创建 72h 后） → 物理删除
--   * 长期任务（is_persistent=TRUE）一律豁免，永不归档/删除
--   * analysis_task 完成时由 service 层补 expires_at = completed_at + 24h（短于普通 72h，
--     因为分析类任务用户看完即可弃，不需要长期保留）
-- archived_at 字段已经在 20260602020500 migration 里加过（当时只是预留），
-- 本次启用 + 加 is_persistent / expires_at 两个新字段。

ALTER TABLE public.mobile_actions
  ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;

COMMENT ON COLUMN public.mobile_actions.is_persistent IS
  '长期任务（盯盘 price_watch / 定时 cron_task 等）= TRUE，cron 不参与归档与删除。';
COMMENT ON COLUMN public.mobile_actions.expires_at IS
  '到期自动删除时间。analysis_task 完成时设 completed_at + 24h；其他类型由 cron 兜底 72h。';

-- 数据回填：现有 price_watch 行动卡都标为长期
UPDATE public.mobile_actions
   SET is_persistent = TRUE
 WHERE kind = 'price_watch'
   AND is_persistent = FALSE;

-- cron 扫描索引（包含部分谓词，只索引非长期行）
CREATE INDEX IF NOT EXISTS mobile_actions_lifecycle_idx
  ON public.mobile_actions (user_id, archived_at, expires_at, created_at)
  WHERE is_persistent = FALSE;
