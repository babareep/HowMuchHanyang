export interface ReturnTrade {
  id: string;
  status: string;
  rental_start_date?: string | null;
  rental_end_date?: string | null;
  item?: { title?: string; trade_type: string; status: string } | null;
}
export type ReturnState = {
  kind: 'scheduled' | 'upcoming' | 'due-today' | 'overdue' | 'returned' | 'unknown';
  dueDate: string | null;
  days: number;
};
const DAY = 86400000;
function dateValue(value?: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
}
export function koreaDate(now: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
}
export function isReturnComplete(trade: ReturnTrade): boolean {
  return trade.item?.trade_type === 'RENTAL' && (trade.status === 'COMPLETED' || (trade.status === 'APPROVED' && trade.item.status === 'COMPLETED'));
}
export function getReturnState(trade: ReturnTrade, today: string): ReturnState | null {
  if (trade.item?.trade_type !== 'RENTAL') return null;
  // The existing app completes only the item. Preserve that legacy behavior
  // without inventing a new DB column or calling an undefined RPC.
  if (isReturnComplete(trade)) {
    return { kind: 'returned', dueDate: trade.rental_end_date ?? null, days: 0 };
  }
  if (trade.status !== 'APPROVED') return null;
  const end = dateValue(trade.rental_end_date), start = dateValue(trade.rental_start_date), current = dateValue(today);
  if (end === null || start === null || current === null || start > end) return { kind: 'unknown', dueDate: null, days: 0 };
  const days = (end - current) / DAY;
  return { kind: current < start ? 'scheduled' : days < 0 ? 'overdue' : days === 0 ? 'due-today' : 'upcoming', dueDate: trade.rental_end_date!, days: Math.abs(days) };
}
export function returnLabel(state: ReturnState): string {
  switch (state.kind) {
    case 'returned': return '반납 완료';
    case 'overdue': return `반납 기한 ${state.days}일 초과`;
    case 'due-today': return '오늘 반납';
    case 'scheduled': return `대여 시작 전 · 반납까지 ${state.days}일`;
    case 'upcoming': return `반납까지 ${state.days}일`;
    case 'unknown': return '반납일 확인 필요';
  }
}
export function collectReturnTrades(received: ReturnTrade[], sent: ReturnTrade[], today: string) {
  const result = new Map<string, { trade: ReturnTrade; state: ReturnState; direction: 'received' | 'sent' }>();
  for (const [trades, direction] of [[sent, 'sent'], [received, 'received']] as const) {
    for (const trade of trades) {
      const state = getReturnState(trade, today);
      if (state && state.kind !== 'returned') result.set(trade.id, { trade, state, direction });
    }
  }
  return [...result.values()].sort((a, b) => {
    if (!a.state.dueDate) return b.state.dueDate ? 1 : a.trade.id.localeCompare(b.trade.id);
    if (!b.state.dueDate) return -1;
    return a.state.dueDate.localeCompare(b.state.dueDate) || a.trade.id.localeCompare(b.trade.id);
  });
}

export function returnCountdown(state: ReturnState): string {
  if (state.kind === 'overdue') return `D-${state.days}!!`;
  if (state.kind === 'due-today') return 'D-Day';
  if (state.kind === 'upcoming' || state.kind === 'scheduled') return `D-${state.days}`;
  return returnLabel(state);
}
export function returnTextColor(state: ReturnState): string {
  if (state.kind === 'returned') return 'text-emerald-700';
  if (state.kind === 'unknown') return 'text-slate-500';
  if (state.kind === 'overdue' || state.kind === 'due-today') return 'text-red-800';
  if (state.days <= 3) return 'text-red-700';
  if (state.days <= 7) return 'text-red-600';
  if (state.days <= 14) return 'text-rose-600';
  if (state.days <= 30) return 'text-rose-500';
  return 'text-slate-600';
}
