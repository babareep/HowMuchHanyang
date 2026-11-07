'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Item, TradeRequest } from '@/types/item';
import { requestStatusLabel } from '@/types/item';

// 상세 화면 하단의 구매 요청 영역. 상태 변경은 모두 DB 함수(RPC)에서 검증합니다.
export default function PurchaseRequestPanel({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [myRequest, setMyRequest] = useState<TradeRequest | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || user.id === item.seller_id) return;
    let active = true;
    supabase.from('trade_requests').select('*').eq('item_id', item.id).eq('requester_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (active) setMyRequest(data); });
    return () => { active = false; };
  }, [user, item.id, item.seller_id]);

  if (item.trade_type !== 'SALE' || user === undefined) return null;

  if (!user) {
    return <p className="rounded-xl bg-slate-100 p-4 text-slate-600">구매 요청은 <Link href="/" className="font-bold text-blue-700 underline">로그인</Link> 후 보낼 수 있습니다.</p>;
  }

  if (user.id === item.seller_id) {
    return (
      <p className="rounded-xl bg-blue-50 p-4 text-blue-900">
        내가 등록한 상품입니다. <Link href="/trades" className="font-bold underline">내 거래</Link>에서 받은 구매 요청을 확인하세요.
      </p>
    );
  }

  const active = myRequest && (myRequest.status === 'PENDING' || myRequest.status === 'APPROVED' || myRequest.status === 'COMPLETED');

  const sendRequest = async () => {
    if (sending) return;
    setSending(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc('create_purchase_request', { p_item_id: item.id });
      if (error) setMessage({ type: 'error', text: error.message });
      else {
        setMyRequest(data as TradeRequest);
        setMessage({ type: 'ok', text: '구매 요청을 보냈습니다. 판매자의 승인을 기다려 주세요.' });
      }
    } catch {
      setMessage({ type: 'error', text: '네트워크 연결을 확인하고 다시 시도해 주세요.' });
    } finally {
      setSending(false);
      onChanged();
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      {myRequest && (
        <p className="text-slate-700">내 요청 상태: <strong>{requestStatusLabel(myRequest.status)}</strong> · <Link href="/trades" className="text-blue-700 underline">내 거래</Link></p>
      )}
      {!active && (
        item.status === 'AVAILABLE'
          ? <button onClick={sendRequest} disabled={sending} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {sending ? '요청 보내는 중...' : '구매 요청 보내기'}
            </button>
          : <p className="text-slate-500">이미 예약되었거나 판매가 완료된 상품입니다.</p>
      )}
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}>{message.text}</p>}
    </div>
  );
}
