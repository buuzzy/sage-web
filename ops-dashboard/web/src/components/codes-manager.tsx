import { useState } from 'react';
import { Table, Switch, InputNumber, Input, Button, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Copy, Plus, Check } from 'lucide-react';
import type { AdminCodeRow } from '../api';
import { createCode, updateCode } from '../api';
import { formatShanghaiDateTime, relativeDays } from '../api';

export function CodesManager({
  codes,
  onChange,
  disabled,
}: {
  codes: AdminCodeRow[];
  onChange: () => void;
  disabled?: boolean;
}) {
  const [maxUses, setMaxUses] = useState<number>(100);
  const [note, setNote] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const row = await createCode({ max_uses: maxUses, note: note.trim() || null });
      message.success(`已生成兑换码：${row.code}`);
      setNote('');
      onChange();
    } catch (e) {
      message.error(`生成失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  const onToggle = async (id: string, isActive: boolean) => {
    try {
      await updateCode(id, { is_active: isActive });
      message.success(isActive ? '已启用' : '已停用');
      onChange();
    } catch (e) {
      message.error(`操作失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      message.error('复制失败');
    }
  };

  const columns: ColumnsType<AdminCodeRow> = [
    {
      title: '兑换码',
      dataIndex: 'code',
      key: 'code',
      render: (v: string, row) => (
        <span className="inline-flex items-center gap-2">
          <code
            className="font-mono text-sm px-1.5 py-0.5 rounded"
            style={{ background: 'var(--surface-elevated)' }}
          >
            {v}
          </code>
          <button
            onClick={() => copyCode(v, row.id)}
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--ink-secondary)' }}
            title="复制"
          >
            {copiedId === row.id ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </span>
      ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (v: string | null) =>
        v || <span style={{ color: 'var(--ink-muted)' }}>—</span>,
    },
    {
      title: '使用',
      key: 'usage',
      width: 160,
      render: (_, row) => {
        const pct = row.maxUses > 0 ? row.usedCount / row.maxUses : 0;
        const full = row.usedCount >= row.maxUses;
        return (
          <div>
            <div className="text-xs tabular-nums" style={{ color: 'var(--ink-secondary)' }}>
              {row.usedCount} / {row.maxUses}
            </div>
            <div
              className="mt-1 h-1.5 w-24 rounded overflow-hidden"
              style={{ background: 'var(--surface-elevated)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, pct * 100)}%`,
                  background: full ? 'var(--status-warning)' : 'var(--series-1)',
                }}
              />
            </div>
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <Tag color="green">已启用</Tag>
        ) : (
          <Tag>已停用</Tag>
        ),
    },
    {
      title: '最近兑换',
      dataIndex: 'lastRedeemedAt',
      key: 'lastRedeemedAt',
      render: (v: string | null) =>
        v ? (
          <span className="text-xs tabular-nums" style={{ color: 'var(--ink-secondary)' }}>
            {formatShanghaiDateTime(v)}
            <span className="ml-1" style={{ color: 'var(--ink-muted)' }}>
              ({relativeDays(v)})
            </span>
          </span>
        ) : (
          <span style={{ color: 'var(--ink-muted)' }}>—</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      render: (_, row) => (
        <Switch
          size="small"
          checked={row.isActive}
          disabled={disabled}
          onChange={(checked) => void onToggle(row.id, checked)}
        />
      ),
    },
  ];

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">兑换码管理</h2>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          一批一码便于追踪渠道
        </span>
      </header>

      <div
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg p-3"
        style={{ background: 'var(--surface-elevated)' }}
      >
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--ink-muted)' }}>
            批次上限
          </label>
          <InputNumber
            min={1}
            max={100000}
            value={maxUses}
            onChange={(v) => setMaxUses(typeof v === 'number' ? v : 100)}
            disabled={creating}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs mb-1" style={{ color: 'var(--ink-muted)' }}>
            备注（可选）
          </label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：WAVE1-熟人"
            disabled={creating}
            maxLength={200}
          />
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => void onCreate()}
          loading={creating}
        >
          生成兑换码
        </Button>
      </div>

      <Table<AdminCodeRow>
        rowKey="id"
        columns={columns}
        dataSource={codes}
        size="small"
        pagination={codes.length > 15 ? { pageSize: 15 } : false}
        locale={{ emptyText: '暂无兑换码' }}
      />
    </section>
  );
}