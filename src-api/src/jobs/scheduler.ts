/**
 * Phase 3 Background Job Scheduler
 *
 * 使用 node-cron 在 sage-api 进程内嵌定时任务。
 *
 * 当前注册的任务：
 *   · persona-distill: 每天凌晨 2 点北京时间 → 跑所有用户的 persona 蒸馏
 *
 * 启动条件（同时满足才注册）：
 *   1. process.env.SAGE_ENABLE_BACKGROUND_JOBS === 'true'
 *      → Railway / 受控服务器才打开；桌面端 sidecar 默认关闭
 *   2. process.env.SUPABASE_SERVICE_ROLE_KEY 已配置
 *      → 没有 service-role 拉不到跨用户数据
*   3. process.env.MINIMAX_API_KEY 已配置
*      → 无 LLM key 蒸馏跑不了
*
* 注：调度器只在 Railway 上运行。桌面端用户的对话也走 Railway sage-api
* 时会被纳入；本地纯 sidecar 模式下用户数据本来就同步到云端，由 Railway 蒸馏。
*/

import cron from 'node-cron';

import { getBuiltInModelConfig } from '@/shared/builtin-model';

import { distillAllUsers } from './distill-persona.js';

let registered = false;

/**
 * 注册 Phase 3 后台任务。
 * 必须在 sage-api 启动后、accept request 前调用。
 * 多次调用是幂等的（防止重复注册）。
 */
export function registerBackgroundJobs(): void {
  if (registered) return;

  if (process.env.SAGE_ENABLE_BACKGROUND_JOBS !== 'true') {
    console.log(
      '[scheduler] background jobs disabled (SAGE_ENABLE_BACKGROUND_JOBS != true)'
    );
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '[scheduler] SAGE_ENABLE_BACKGROUND_JOBS=true but SUPABASE_SERVICE_ROLE_KEY missing — skipping registration'
    );
    return;
  }

  // ── 条件单监控：已下线（iOS 投资对讲机归档后 price-watch service 已删除） ─
  //    原逻辑：每分钟扫描「监控中」的条件想法，命中行情阈值则转为待确认下单卡。
  //    只依赖 service-role（不需要 LLM key），所以独立于 persona 蒸馏注册。
  //    已删除 price-watch service；保留此注释作为历史。

  // ── 阅后即焚：已下线（iOS 投资对讲机归档后 mobile_actions 表无写入方，cron 失效） ─
  //    原逻辑：每天 02:30 北京时间扫描 mobile_actions（避开 02:00 蒸馏）
  //           1) 过期 → 删；2) 24h+ 未处理 → 归档；3) 归档 48h+ → 删（总寿命 72h）。
  //    已删除 action-lifecycle.ts + mobile-actions service。保留此注释作为历史。

  if (!getBuiltInModelConfig()) {
    console.warn(
      '[scheduler] MINIMAX_API_KEY missing — persona-distill skipped'
    );
    registered = true;
    return;
  }

  // 北京时间凌晨 2 点 = UTC 18:00（前一天）
  // node-cron 默认按 server timezone，在 Railway 通常是 UTC，所以写 0 18 * * *
  // 显式 timezone 'Asia/Shanghai' 让本地/Railway 行为一致
  cron.schedule(
    '0 2 * * *',
    async () => {
      const startedAt = new Date().toISOString();
      console.log(`[scheduler] persona-distill: started at ${startedAt}`);
      try {
        const summary = await distillAllUsers();
        console.log(
          `[scheduler] persona-distill: done in ${summary.total_duration_ms}ms ` +
            `(${summary.ran} ran / ${summary.skipped} skipped / ${summary.errors} errors of ${summary.total_users} users)`
        );
        if (summary.errors > 0) {
          for (const u of summary.per_user) {
            if (u.error) {
              console.error(
                `[scheduler] persona-distill: user ${u.user_id} failed: ${u.error}`
              );
            }
          }
        }
      } catch (e) {
        console.error(
          `[scheduler] persona-distill: top-level failure:`,
          e instanceof Error ? e.message : String(e)
        );
      }
    },
    { timezone: 'Asia/Shanghai' }
  );

  registered = true;
  console.log(
    '[scheduler] persona-distill cron registered: 0 2 * * * (Asia/Shanghai)'
  );
}
