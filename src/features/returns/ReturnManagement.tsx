'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { collectReturnTrades, getReturnState, koreaDate, returnLabel, type ReturnState, type ReturnTrade } from './return-status';

const TodayContext = createContext('');
function subscribeDate(callback: () => void) {
  const timer = window.setInterval(callback, 30000);
  const visible = () => { if (document.visibilityState === 'visible') callback(); };
  window.addEventListener('focus', callback);
  document.addEventListener('visibilitychange', visible);
  return () => { window.clearInterval(timer); window.removeEventListener('focus', callback); document.removeEventListener('visibilitychange', visible); };
}
const readDate = () => koreaDate(new Date());
const serverDate = () => '';
export function ReturnManagementProvider({ children }: { children: ReactNode }) {
  const today = useSyncExternalStore(subscribeDate, readDate, serverDate);
  return <TodayContext.Provider value={today}>{children}</TodayContext.Provider>;
}
function tone(state: ReturnState) {
  if (state.kind === 'overdue') return 'border-rose-200 bg-rose-50 text-rose-900';
  if (state.kind === 'due-today' || (state.kind === 'upcoming' && state.days <= 3)) return 'border-amber-200 bg-amber-50 text-amber-900';
  if (state.kind === 'returned') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}
export function ReturnNotice({ trade, owner = false }: { trade: ReturnTrade; owner?: boolean }) {
  const today = useContext(TodayContext);
  if (!today) return null;
  const state = getReturnState(trade, today);
  if (!state) return null;
  return <div className={`rounded-xl border p-4 text-sm ${tone(state)}`}>
    <p className="font-extrabold">{returnLabel(state)}</p>
    {state.dueDate && state.kind !== 'returned' && <p className="mt-1">반납일: {state.dueDate} · 한국 시간 기준</p>}
    {state.kind === 'overdue' && <p className="mt-2">{owner ? '아직 반납 완료로 확인되지 않았습니다. 상대방과 반납 일정을 확인해 주세요.' : '반납 기한이 지났습니다. 판매자에게 연락해 반납 일정을 확인해 주세요.'}</p>}
    {state.kind === 'due-today' && <p className="mt-2">{owner ? '오늘 반납 예정입니다. 물건을 돌려받은 뒤 반납 완료를 처리해 주세요.' : '오늘까지 반납해 주세요. 반납 후 판매자가 완료를 확인합니다.'}</p>}
    {state.kind === 'unknown' && <p className="mt-1">대여 기간 정보를 확인해 주세요.</p>}
  </div>;
}
export function ReturnDashboard({ received, sent, onNavigate }: { received: ReturnTrade[]; sent: ReturnTrade[]; onNavigate: (tab: 'RECEIVED' | 'SENT') => void }) {
  const today = useContext(TodayContext);
  if (!today) return <p role="status" className="mb-6 text-sm text-slate-500">반납 일정을 확인하는 중입니다...</p>;
  const entries = collectReturnTrades(received, sent, today);
  const due = entries.filter(e => e.state.kind === 'due-today').length;
  const overdue = entries.filter(e => e.state.kind === 'overdue').length;
  const reminders = entries.filter(e => e.state.kind === 'overdue' || e.state.kind === 'due-today' || (e.state.kind === 'upcoming' && e.state.days <= 3));
  return <section aria-label="반납 일정 알림" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold text-slate-900">반납 일정</h2><span className="text-xs text-slate-500">{today} · 한국 시간</span></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><p className="rounded-xl bg-slate-50 p-3 text-slate-700">대여 일정<strong className="mt-1 block text-xl">{entries.filter(e => e.state.kind !== 'unknown').length}</strong></p><p className="rounded-xl bg-amber-50 p-3 text-amber-900">오늘 반납<strong className="mt-1 block text-xl">{due}</strong></p><p className="rounded-xl bg-rose-50 p-3 text-rose-900">기한 초과<strong className="mt-1 block text-xl">{overdue}</strong></p></div>
    <p className="mt-3 text-xs text-slate-500">앱 내 안내입니다. 이메일은 자동 발송되지 않습니다.</p>
    {reminders.length ? <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto" aria-label="다가오는 반납 및 기한 초과">{reminders.map(({ trade, state, direction }) => <li key={trade.id} className={`rounded-xl border p-3 text-sm ${tone(state)}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{trade.item?.title || '대여 상품'} · {returnLabel(state)}</span><button type="button" className="font-semibold underline" onClick={() => onNavigate(direction === 'sent' ? 'SENT' : 'RECEIVED')}>{direction === 'sent' ? '내가 빌린 물건' : '빌려준 물건'} 보기</button></div><p className="mt-1">반납일: {state.dueDate}</p></li>)}</ul> : <p className="mt-4 text-sm text-slate-600">{entries.length ? '3일 이내 반납 예정 또는 기한 초과인 거래가 없습니다.' : '확인할 대여 반납 일정이 없습니다.'}</p>}
    {entries.some(e => e.state.kind === 'unknown') && <p className="mt-3 text-sm text-amber-800">반납일이 누락되거나 잘못된 거래가 있습니다. 받은 요청·보낸 요청에서 확인해 주세요.</p>}
  </section>;
}
