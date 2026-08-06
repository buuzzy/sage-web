-- ============================================================
-- Sage 兑换码（邀请码）系统
-- 档位 B：注册时验证码 + 兑换码同一步完成
-- RLS 在所有业务表上追加 is_user_activated() 激活门槛
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. profiles 增加激活标志
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT false;

-- 老用户全部默认已激活（一次性回填）
UPDATE public.profiles
  SET is_activated = true
  WHERE is_activated = false;

-- ────────────────────────────────────────────────────────────
-- 2. invite_codes：兑换码主表
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  max_uses    INT  NOT NULL DEFAULT 100,
  used_count  INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.invite_codes IS '兑换码主表，运营手动管理';

CREATE TRIGGER trg_invite_codes_updated_at
  BEFORE UPDATE ON public.invite_codes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. code_redemptions：兑换流水（审计 + 防重复）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.code_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_code_redemptions_user
  ON public.code_redemptions (user_id);

-- ────────────────────────────────────────────────────────────
-- 4. 新表 RLS：无 policy = 完全不可访问（仅 service_role 可操作）
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_redemptions ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 5. helper: is_user_activated()
--    SECURITY DEFINER 避免 RLS 递归
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_user_activated()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_activated FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 6. RPC: redeem_invite_code(p_code)
--    原子：锁行 -> 校验 -> 插流水 -> 扣次数 -> 激活用户
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code   RECORD;
  v_uid    UUID := auth.uid();
  v_active BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '请先登录后再兑换';
  END IF;

  SELECT is_activated INTO v_active FROM public.profiles WHERE id = v_uid;
  IF v_active THEN
    RETURN jsonb_build_object('success', true, 'message', '账号已激活');
  END IF;

  SELECT * INTO v_code
  FROM public.invite_codes
  WHERE UPPER(code) = UPPER(TRIM(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '兑换码无效';
  END IF;

  IF NOT v_code.is_active THEN
    RAISE EXCEPTION '兑换码已停用';
  END IF;

  IF v_code.used_count >= v_code.max_uses THEN
    RAISE EXCEPTION '兑换码已达使用上限';
  END IF;

  INSERT INTO public.code_redemptions (code_id, user_id)
  VALUES (v_code.id, v_uid)
  ON CONFLICT (code_id, user_id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION '你已使用过该兑换码';
  END IF;

  UPDATE public.invite_codes
    SET used_count = used_count + 1
    WHERE id = v_code.id;

  UPDATE public.profiles
    SET is_activated = true
    WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'message', '兑换成功');
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. 更新 15 张业务表 RLS：追加 is_user_activated() 门槛
--    profiles / error_logs 不动
-- ────────────────────────────────────────────────────────────

-- sessions
DROP POLICY IF EXISTS "sessions: 本人可读写" ON public.sessions;
CREATE POLICY "sessions: 本人可读写"
  ON public.sessions FOR ALL
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());

-- user_settings
DROP POLICY IF EXISTS "user_settings: 本人可读写" ON public.user_settings;
CREATE POLICY "user_settings: 本人可读写"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());

-- tasks
DROP POLICY IF EXISTS "Users can read their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
CREATE POLICY "Users can read their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can insert their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- messages
DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can read their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- files
DROP POLICY IF EXISTS "Users can read their own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert their own files" ON public.files;
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;
CREATE POLICY "Users can read their own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can insert their own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can update their own files"
  ON public.files FOR UPDATE
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can delete their own files"
  ON public.files FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- persona_memory
DROP POLICY IF EXISTS "Users can read their own persona_memory" ON public.persona_memory;
DROP POLICY IF EXISTS "Users can insert their own persona_memory" ON public.persona_memory;
DROP POLICY IF EXISTS "Users can update their own persona_memory" ON public.persona_memory;
DROP POLICY IF EXISTS "Users can delete their own persona_memory" ON public.persona_memory;
CREATE POLICY "Users can read their own persona_memory"
  ON public.persona_memory FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can insert their own persona_memory"
  ON public.persona_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can update their own persona_memory"
  ON public.persona_memory FOR UPDATE
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can delete their own persona_memory"
  ON public.persona_memory FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- user_notes
DROP POLICY IF EXISTS "Users can read their own user_notes" ON public.user_notes;
DROP POLICY IF EXISTS "Users can insert their own user_notes" ON public.user_notes;
DROP POLICY IF EXISTS "Users can update their own user_notes" ON public.user_notes;
DROP POLICY IF EXISTS "Users can delete their own user_notes" ON public.user_notes;
CREATE POLICY "Users can read their own user_notes"
  ON public.user_notes FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can insert their own user_notes"
  ON public.user_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can update their own user_notes"
  ON public.user_notes FOR UPDATE
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can delete their own user_notes"
  ON public.user_notes FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- sync_state
DROP POLICY IF EXISTS "Users can read their own sync_state" ON public.sync_state;
DROP POLICY IF EXISTS "Users can insert their own sync_state" ON public.sync_state;
DROP POLICY IF EXISTS "Users can update their own sync_state" ON public.sync_state;
DROP POLICY IF EXISTS "Users can delete their own sync_state" ON public.sync_state;
CREATE POLICY "Users can read their own sync_state"
  ON public.sync_state FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can insert their own sync_state"
  ON public.sync_state FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can update their own sync_state"
  ON public.sync_state FOR UPDATE
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can delete their own sync_state"
  ON public.sync_state FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- user_behavior
DROP POLICY IF EXISTS "user_behavior_self_select" ON public.user_behavior;
DROP POLICY IF EXISTS "user_behavior_self_insert" ON public.user_behavior;
CREATE POLICY "user_behavior_self_select"
  ON public.user_behavior FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "user_behavior_self_insert"
  ON public.user_behavior FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());

-- user_providers
DROP POLICY IF EXISTS "user_providers_owner_select" ON public.user_providers;
DROP POLICY IF EXISTS "user_providers_owner_insert" ON public.user_providers;
DROP POLICY IF EXISTS "user_providers_owner_update" ON public.user_providers;
DROP POLICY IF EXISTS "user_providers_owner_delete" ON public.user_providers;
CREATE POLICY "user_providers_owner_select"
  ON public.user_providers FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "user_providers_owner_insert"
  ON public.user_providers FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "user_providers_owner_update"
  ON public.user_providers FOR UPDATE
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "user_providers_owner_delete"
  ON public.user_providers FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- user_watchlist
DROP POLICY IF EXISTS "user_watchlist_self_all" ON public.user_watchlist;
CREATE POLICY "user_watchlist_self_all"
  ON public.user_watchlist FOR ALL
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());

-- investment_board_events
DROP POLICY IF EXISTS "Users can read own board events" ON public.investment_board_events;
DROP POLICY IF EXISTS "Users can insert own board events" ON public.investment_board_events;
DROP POLICY IF EXISTS "Users can delete own board events" ON public.investment_board_events;
CREATE POLICY "Users can read own board events"
  ON public.investment_board_events FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can insert own board events"
  ON public.investment_board_events FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());
CREATE POLICY "Users can delete own board events"
  ON public.investment_board_events FOR DELETE
  USING (auth.uid() = user_id AND public.is_user_activated());

-- idea_notes
DROP POLICY IF EXISTS "idea_notes_self_all" ON public.idea_notes;
CREATE POLICY "idea_notes_self_all"
  ON public.idea_notes FOR ALL
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());

-- mobile_actions
DROP POLICY IF EXISTS "mobile_actions_self_all" ON public.mobile_actions;
CREATE POLICY "mobile_actions_self_all"
  ON public.mobile_actions FOR ALL
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());

-- mobile_device_tokens
DROP POLICY IF EXISTS "mobile_device_tokens_self_all" ON public.mobile_device_tokens;
CREATE POLICY "mobile_device_tokens_self_all"
  ON public.mobile_device_tokens FOR ALL
  USING (auth.uid() = user_id AND public.is_user_activated())
  WITH CHECK (auth.uid() = user_id AND public.is_user_activated());

-- ────────────────────────────────────────────────────────────
-- 8. 插入 3 个初始兑换码（各 100 次）
-- ────────────────────────────────────────────────────────────

INSERT INTO public.invite_codes (code, max_uses, note) VALUES
  ('EMQU6', 100, '初始内测码 A'),
  ('K7RCP', 100, '初始内测码 B'),
  ('2FFCH', 100, '初始内测码 C')
ON CONFLICT (code) DO NOTHING;
