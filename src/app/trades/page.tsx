'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/types/item';
import { itemStatusLabel } from '@/types/item';
import ItemImage from '@/components/ItemImage';
import { canApprove, rentalDays, requestLabels, tradeError, type RequestWithItem, type TradeRequest } from '@/lib/trades';

type Tab = 'items' | 'received' | 'sent';
type Snapshot = { userId: string; items: Item[]; received: RequestWithItem[]; sent: RequestWithItem[] };
const buttonClass = 'rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600';

export default function TradesPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const actionLock = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const revision = ++generation.current;
    let active = true;
    async function load() {
      setLoading(true); setError(''); setSnapshot(null);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
        if (!user) {
          if (active) setLoggedOut(true);
          return;
        }
        if (active) setLoggedOut(false);
        const [owned, sent] = await Promise.all([
          supabase.from('items').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
          supabase.from('trade_requests').select('*').eq('buyer_id', user.id).order('created_at', { ascending: false }),
        ]);
        if (owned.error) throw owned.error;
        if (sent.error) throw sent.error;
        const items = (owned.data ?? []) as Item[];
        const sentRequests = (sent.data ?? []) as TradeRequest[];
        const received = items.length ? await supabase.from('trade_requests').select('*').in('item_id', items.map(i => i.id)).order('created_at', { ascending: false }) : { data: [], error: null };
        if (received.error) throw received.error;
        const missingIds = [...new Set(sentRequests.map(r => r.item_id).filter(id => !items.some(i => i.id === id)))];
        const extra = missingIds.length ? await supabase.from('items').select('*').in('id', missingIds) : { data: [], error: null };
        if (extra.error) throw extra.error;
        const itemMap = new Map([...items, ...((extra.data ?? []) as Item[])].map(i => [i.id, i]));
        const attach = (r: TradeRequest): RequestWithItem => ({ ...r, item: itemMap.get(r.item_id) ?? null });
        if (active && revision === generation.current) setSnapshot({ userId: user.id, items, received: (received.data as TradeRequest[]).map(attach), sent: sentRequests.map(attach) });
      } catch (cause) { if (active && revision === generation.current) setError(tradeError(cause)); }
      finally { if (active && revision === generation.current) setLoading(false); }
    }
    load();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        generation.current++; setSnapshot(null); setNotice(''); setError('');
        setLoggedOut(event === 'SIGNED_OUT'); setReload(n => n + 1);
      }
    });
    const refresh = () => { if (!actionLock.current) setReload(n => n + 1); };
    window.addEventListener('focus', refresh);
    return () => { active = false; listener.subscription.unsubscribe(); window.removeEventListener('focus', refresh); };
  }, [reload]);

  async function update(request: RequestWithItem, action: 'APPROVE' | 'REJECT' | 'COMPLETE') {
    if (!snapshot || request.item?.seller_id !== snapshot.userId || actionLock.current) return;
    const label = action === 'APPROVE' ? '승인' : action === 'REJECT' ? '거절' : request.item.trade_type === 'RENTAL' ? '반납 완료' : '판매 완료';
    if (!window.confirm(`이 요청을 ${label} 처리하시겠습니까?`)) return;
    const revision = generation.current;
    actionLock.current = true; setBusy(request.id); setError(''); setNotice('');
    try {
      const { error: actionError } = await supabase.rpc('phase6_update_trade', { p_request_id: request.id, p_action: action });
      if (actionError) throw actionError;
      if (revision === generation.current) { setNotice(`${label} 처리되었습니다.`); setReload(n => n + 1); }
    } catch (cause) { if (revision === generation.current) setError(tradeError(cause)); }
    finally { actionLock.current = false; setBusy(null); }
  }

  function requestCard(request: RequestWithItem, received: boolean) {
    const item = request.item;
    const days = rentalDays(request.rental_start_date, request.rental_end_date);
    return <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{item ? <Link className="hover:underline" href={`/items/${encodeURIComponent(item.id)}`}>{item.title}</Link> : '조회할 수 없는 상품'}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${request.status === 'APPROVED' ? 'bg-blue-50 text-blue-800' : request.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{requestLabels[request.status] ?? request.status}</span></div>
      <p className="mt-2 text-sm text-slate-500">{received ? '받은 요청' : '보낸 요청'} · {new Date(request.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
      {item && <p className="mt-3 font-semibold">{item.trade_type === 'SALE' ? '판매' : '대여'} · {item.price.toLocaleString()}원{item.trade_type === 'RENTAL' ? ' / 1일' : ''} · {item.location}</p>}
      {request.rental_start_date && <p className="mt-2 text-sm text-slate-600">대여 기간: {request.rental_start_date} ~ {request.rental_end_date}{item && days > 0 && ` · ${days}일 · 총 ${(days * item.price).toLocaleString()}원`}</p>}
      {request.status === 'COMPLETED' && <p className="mt-3 text-sm text-emerald-700">{item?.trade_type === 'RENTAL' ? '반납이 완료되었습니다.' : '판매가 완료되었습니다.'}</p>}
      {received && item && item.seller_id === snapshot?.userId && <div className="mt-4 flex flex-wrap gap-2">
        {canApprove(item, request) && <button disabled={busy !== null} className={`${buttonClass} bg-blue-700 text-white`} onClick={() => update(request, 'APPROVE')}>승인하기</button>}
        {request.status === 'PENDING' && <button disabled={busy !== null} className={`${buttonClass} border border-slate-300`} onClick={() => update(request, 'REJECT')}>거절하기</button>}
        {request.status === 'APPROVED' && <button disabled={busy !== null} className={`${buttonClass} bg-emerald-700 text-white`} onClick={() => update(request, 'COMPLETE')}>{item.trade_type === 'RENTAL' ? '반납 완료하기' : '판매 완료하기'}</button>}
        {busy === request.id && <span role="status" className="self-center text-sm text-slate-500">처리 중...</span>}
      </div>}
    </article>;
  }

  return <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
    <div className="mx-auto max-w-4xl"><Link href="/" className="font-semibold text-blue-700 hover:underline">← 상품 목록</Link>
      <div className="my-6 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-extrabold">내 거래</h1><p className="mt-2 text-sm text-slate-500">등록한 상품과 주고받은 거래 요청을 확인하세요.</p></div>
        <button disabled={loading || busy !== null} onClick={() => setReload(n => n + 1)} className={`${buttonClass} border border-slate-300 bg-white`}>새로고침</button></div>
      {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
      {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800"><p>{error}</p><button className="mt-2 underline" disabled={busy !== null} onClick={() => setReload(n => n + 1)}>다시 불러오기</button></div>}
      {loggedOut ? <section className="rounded-2xl bg-white p-8 text-center"><h2 className="text-xl font-bold">로그인이 필요합니다.</h2><Link href="/" className="mt-4 inline-block text-blue-700 underline">홈에서 로그인하기</Link></section> : <>
        <nav aria-label="거래 분류" className="mb-6 grid grid-cols-3 gap-2">{([['items', '내가 등록한 상품', snapshot?.items.length], ['received', '받은 요청', snapshot?.received.length], ['sent', '보낸 요청', snapshot?.sent.length]] as const).map(([value, label, count]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)} className={`${buttonClass} py-4 ${tab === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}{count !== undefined && ` (${count})`}</button>)}</nav>
        {loading ? <p role="status" className="py-12 text-center text-slate-500">거래를 불러오는 중입니다...</p> : snapshot && <section aria-label={tab === 'items' ? '내가 등록한 상품' : tab === 'received' ? '받은 요청' : '보낸 요청'} className="space-y-4">
          {tab === 'items' ? snapshot.items.length ? snapshot.items.map(item => <article key={item.id} className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-5"><Link className="w-32 shrink-0" href={`/items/${encodeURIComponent(item.id)}`}><ItemImage src={item.image_url} title={item.title} /></Link><div><Link className="text-lg font-bold hover:underline" href={`/items/${encodeURIComponent(item.id)}`}>{item.title}</Link><p className="mt-2 text-sm text-slate-600">{item.trade_type === 'SALE' ? '판매' : '대여'} · {item.price.toLocaleString()}원{item.trade_type === 'RENTAL' && ' / 1일'}</p><p className="mt-2 text-sm font-semibold text-blue-700">{itemStatusLabel(item.status)}</p>{item.trade_type === 'RENTAL' && <p className="mt-2 text-sm text-slate-500">대여 가능: {item.rental_start_date} ~ {item.rental_end_date}</p>}</div></article>) : <Empty text="아직 등록한 상품이 없습니다." />
            : (tab === 'received' ? snapshot.received : snapshot.sent).length ? (tab === 'received' ? snapshot.received : snapshot.sent).map(r => requestCard(r, tab === 'received')) : <Empty text={tab === 'received' ? '아직 받은 요청이 없습니다.' : '아직 보낸 요청이 없습니다.'} />}
          {tab === 'items' && <Link href="/write" className="inline-block rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">+ 상품 등록하기</Link>}
        </section>}
      </>}
    </div>
  </main>;
}
function Empty({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{text}</p>; }
