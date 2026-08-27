import { RefreshCw, LogOut, AlertCircle } from 'lucide-react';
import type { AdminMetrics } from './api';
import { formatShanghaiDateTime } from './api';
import { StatCards } from './components/stat-cards';
import { Funnel } from './components/funnel';
import { DailyActivity } from './components/daily-activity';
import { RedemptionTrend } from './components/redemption-trend';
import { CohortMatrix } from './components/cohort-matrix';
import { CodesManager } from './components/codes-manager';
import { SkillUsage } from './components/skill-usage';
import { RecentActivity } from './components/recent-activity';

interface Props {
  data: AdminMetrics | null;
  loading: boolean;
  error: string | null;
  generatedAt: string | null;
  onRefresh: () => void;
  onLogout: () => void;
}

export function Dashboard({ data, loading, error, generatedAt, onRefresh, onLogout }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{
          background: 'color-mix(in oklab, var(--surface-page) 85%, transparent)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <h1 className="text-base font-semibold">Sage 运营看板</h1>
          {generatedAt && (
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              更新于 {formatShanghaiDateTime(generatedAt)} (+08)
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-opacity disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              title="刷新"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
              title="退出并清除本地令牌"
            >
              <LogOut size={14} />
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-4 py-6 space-y-6 flex-1">
        {error && (
          <div
            className="flex items-start gap-2 rounded-lg border p-3 text-sm"
            style={{ borderColor: 'var(--status-serious)', color: 'var(--status-serious)' }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>加载失败：{error}（已保留上次数据，可点击刷新重试）</span>
          </div>
        )}

        {data && (
          <>
            <StatCards overview={data.overview} />
            <div className="grid gap-6 lg:grid-cols-2">
              <Funnel funnel={data.funnel} />
              <RedemptionTrend data={data.redemptionSeries} />
            </div>
            <DailyActivity data={data.dailyActivity} />
            <CodesManager
              codes={data.codes}
              onChange={onRefresh}
              disabled={loading}
            />
            <CohortMatrix cohorts={data.cohorts} />
            <SkillUsage skills={data.skills} assets={data.assets} />
            <RecentActivity
              profiles={data.recentProfiles}
              redemptions={data.recentRedemptions}
            />
          </>
        )}

        {!data && !error && (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ink-muted)' }}>
            <RefreshCw size={20} className="animate-spin mr-2" />
            加载中…
          </div>
        )}
      </main>

      <footer
        className="mx-auto max-w-7xl w-full px-4 py-4 text-xs text-center"
        style={{ color: 'var(--ink-muted)' }}
      >
        ops-dashboard · 数据仅来自 public.profiles / invite_codes / code_redemptions / user_behavior
      </footer>
    </div>
  );
}