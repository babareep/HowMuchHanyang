'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { TradeRequest } from '@/types/item';
import { itemStatusLabel, requestStatusLabel } from '@/types/item';

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-slate-200 text-slate-600',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};

export default function TradesPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [requests, setRequests] = useState<TradeRequest[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('trade_requests')
        .select('*, items(id, title, price, status, trade_type)')
        .eq(tab === 'received' ? 'seller_id' : 'requester_id', user.id)
        .order('created_at', { ascending: false });
      if (error) setLoadError('거래 요청을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      else setRequests(data as TradeRequest[]);
    } catch {
      setLoadError('네트워크 연결을 확인하고 다시 시도해 주세요.');
    }
  }, [user, tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 탭/사용자 변경 시 서버 데이터를 다시 불러옵니다.
    load();
  }, [load]);

  const act = async (req: TradeRequest, action: 'APPROVE' | 'REJECT' | 'COMPLETE') => {
    if (busyId) return;
    if (action === 'COMPLETE' && !confirm('판매 완료로 처리할까요? 되돌릴 수 없습니다.')) return;
    setBusyId(req.id);
    setActionError('');
    try {
      const { error } = action === 'COMPLETE'
        ? await supabase.rpc('complete_purchase_request', { p_request_id: req.id })
        : await supabase.rpc('respond_purchase_request', { p_request_id: req.id, p_action: action });
      if (error) setActionError(error.message);
    } catch {
      setActionError('처리 결과를 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.');
    } finally {
      setBusyId(null);
      await load();
    }
  };

  if (user === undefined) return <p role="status" className="p-8 text-center">로그인 상태를 확인하는 중입니다...</p>;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>로그인이 필요합니다. <Link href="/" className="font-bold text-blue-700 underline">홈에서 로그인</Link></p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="font-semibold text-blue-700 hover:underline">← 상품 목록</Link>
        <h1 className="mt-4 text-2xl font-black text-slate-800">내 거래</h1>
        <p className="text-sm text-slate-500">{user.email}</p>

        <div className="mt-6 flex gap-2" role="tablist">
          {(['received', 'sent'] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t}
              onClick={() => { if (tab !== t) { setRequests(null); setActionError(''); setTab(t); } }}
              className={`rounded-full px-4 py-2 text-sm font-bold ${tab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
              {t === 'received' ? '받은 요청 (내 상품)' : '보낸 요청'}
            </button>
          ))}
        </div>

        {actionError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{actionError}</p>}

        {loadError ? (
          <div role="alert" className="mt-6 rounded-xl bg-red-50 p-6 text-red-700">
            <p>{loadError}</p><button className="mt-3 underline" onClick={load}>다시 시도</button>
          </div>
        ) : requests === null ? (
          <p role="status" className="py-12 text-center text-slate-500">불러오는 중입니다...</p>
        ) : requests.length === 0 ? (
          <p className="mt-6 rounded-xl bg-white p-8 text-center text-slate-500">{tab === 'received' ? '받은 구매 요청이 없습니다.' : '보낸 구매 요청이 없습니다.'}</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {requests.map(req => (
              <li key={req.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/items/${encodeURIComponent(req.item_id)}`} className="text-lg font-bold text-slate-800 hover:underline">
                      {req.items?.title ?? '(삭제된 상품)'}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {req.items ? `${req.items.price.toLocaleString()}원 · 상품 ${itemStatusLabel(req.items.status)}` : ''}
                    </p>
                    {tab === 'received' && <p className="mt-1 text-sm text-slate-600">요청자: {req.requester_email ?? req.requester_id.slice(0, 8)}</p>}
                    <p className="text-xs text-slate-400">{new Date(req.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-extrabold ${statusStyle[req.status] ?? ''}`}>
                    {requestStatusLabel(req.status)}
                  </span>
                </div>

                {tab === 'received' && req.status === 'PENDING' && (
                  <div className="mt-4 flex gap-2">
                    <button disabled={busyId !== null} onClick={() => act(req, 'APPROVE')}
                      className="flex-1 rounded-xl bg-blue-600 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-60">승인</button>
                    <button disabled={busyId !== null} onClick={() => act(req, 'REJECT')}
                      className="flex-1 rounded-xl border border-slate-300 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">거절</button>
                  </div>
                )}
                {tab === 'received' && req.status === 'APPROVED' && (
                  <button disabled={busyId !== null} onClick={() => act(req, 'COMPLETE')}
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {busyId === req.id ? '처리 중...' : '판매 완료'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
