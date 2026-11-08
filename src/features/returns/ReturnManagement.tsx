'use client';

import { createContext, useContext, useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { collectReturnTrades, getReturnState, koreaDate, returnCountdown, returnLabel, returnTextColor, type ReturnState, type ReturnTrade } from './return-status';

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
export function useReturnToday() { return useSyncExternalStore(subscribeDate, readDate, serverDate); }
export function ReturnManagementProvider({ children }: { children: ReactNode }) {
  const today = useReturnToday();
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
    <p className={`font-extrabold ${returnTextColor(state)}`}>{state.kind === 'returned' ? '반납 완료' : `${trade.item?.title || '대여 물품'} : ${returnCountdown(state)}`}{state.kind === 'overdue' && <span className="ml-2 text-xs">기한 초과</span>}</p>
    {state.dueDate && state.kind !== 'returned' && <p className="mt-1">반납일: {state.dueDate} · 한국 시간 기준</p>}
    {state.kind === 'overdue' && <p className="mt-2">{owner ? '아직 반납 완료로 확인되지 않았습니다. 상대방과 반납 일정을 확인해 주세요.' : '반납 기한이 지났습니다. 판매자에게 연락해 반납 일정을 확인해 주세요.'}</p>}
    {state.kind === 'due-today' && <p className="mt-2">{owner ? '오늘 반납 예정입니다. 물건을 돌려받은 뒤 반납 완료를 처리해 주세요.' : '오늘까지 반납해 주세요. 반납 후 판매자가 완료를 확인합니다.'}</p>}
    {state.kind === 'unknown' && <p className="mt-1">대여 기간 정보를 확인해 주세요.</p>}
  </div>;
}
function CountdownLine({ trade, state }: { trade: ReturnTrade; state: ReturnState }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0"><p className="break-words text-base font-extrabold text-slate-900">{trade.item?.title || '대여 물품'} <span className="text-sm font-medium text-slate-500">{state.kind === 'scheduled' ? '대여 예정' : '대여 중'}</span></p><p className="mt-1 text-xs text-slate-500">{state.dueDate ? `반납일 ${state.dueDate}` : '반납일 확인 필요'}</p></div>
    <p className={`text-xl font-black ${returnTextColor(state)}`} aria-label={returnLabel(state)}>{state.kind !== 'unknown' && <span className="mr-2 text-xs font-semibold">{state.kind === 'overdue' ? '기한 초과' : '반납까지'}</span>}{returnCountdown(state)}</p>
  </div>;
}
export function ReturnDashboard({ received, sent, onNavigate }: { received: ReturnTrade[]; sent: ReturnTrade[]; onNavigate: (tab: 'RECEIVED' | 'SENT') => void }) {
  const today = useContext(TodayContext);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  if (!today) return <p role="status" className="mb-6 text-sm text-slate-500">반납 일정을 확인하는 중입니다...</p>;
  const entries = collectReturnTrades(received, sent, today);
  const first = entries[0];
  return <section aria-label="반납 일정 알림" className="mb-6">
    {first ? <>
      <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)} className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600 ${first.state.kind === 'overdue' ? 'border-red-300' : 'border-slate-200'}`}>
        <CountdownLine trade={first.trade} state={first.state} />
        <p className="mt-4 text-xs font-semibold text-slate-500">{expanded ? '대여 물품 접기 ↑' : '눌러서 다른 대여 물품도 확인하기 ↓'}</p>
      </button>
      <div id={panelId} hidden={!expanded} className="mt-3 space-y-3">
        <p className="px-1 text-xs text-slate-500">반납일이 빠른 순 · 한국 시간 기준</p>
        <ul className="space-y-3">{entries.map(({ trade, state, direction }) => <li key={trade.id} className={`rounded-2xl border bg-white p-4 ${state.kind === 'overdue' ? 'border-red-200' : 'border-slate-200'}`}>
          <CountdownLine trade={trade} state={state} />
          <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">{direction === 'sent' ? '내가 빌린 물건' : '빌려준 물건'}</span><button type="button" className="font-semibold text-blue-700 underline" onClick={() => onNavigate(direction === 'sent' ? 'SENT' : 'RECEIVED')}>거래 확인</button></div>
        </li>)}</ul>
      </div>
    </> : <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">현재 반납할 대여 물품이 없습니다.</div>}
  </section>;
}
