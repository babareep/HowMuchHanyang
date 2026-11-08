'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { collectReturnTrades, type ReturnTrade } from './return-status';
import { useReturnToday } from './ReturnManagement';

export default function ReturnNavAlert({ userId }: { userId: string }) {
  const today = useReturnToday();
  const [snapshot, setSnapshot] = useState<{ userId: string; received: ReturnTrade[]; sent: ReturnTrade[] } | null>(null);
  useEffect(() => {
    let active = true;
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const [owned, sent] = await Promise.all([
          supabase.from('items').select('id,title,trade_type,status').eq('seller_id', userId),
          supabase.from('trade_requests').select('id,item_id,status,rental_start_date,rental_end_date').eq('buyer_id', userId).eq('status', 'APPROVED'),
        ]);
        if (owned.error || sent.error) throw owned.error || sent.error;
        const ownedItems = owned.data ?? [];
        const sentRequests = sent.data ?? [];
        const extraIds = [...new Set(sentRequests.map(request => request.item_id).filter(id => !ownedItems.some(item => item.id === id)))];
        const [received, extra] = await Promise.all([
          ownedItems.length ? supabase.from('trade_requests').select('id,item_id,status,rental_start_date,rental_end_date').in('item_id', ownedItems.map(item => item.id)).eq('status', 'APPROVED') : Promise.resolve({ data: [], error: null }),
          extraIds.length ? supabase.from('items').select('id,title,trade_type,status').in('id', extraIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (received.error || extra.error) throw received.error || extra.error;
        const items = new Map([...ownedItems, ...(extra.data ?? [])].map(item => [item.id, item]));
        const attach = (request: typeof sentRequests[number]): ReturnTrade => ({ ...request, item: items.get(request.item_id) ?? null });
        if (active) setSnapshot({ userId, received: (received.data ?? []).map(attach), sent: sentRequests.map(attach) });
      } catch { if (active) setSnapshot(null); }
      finally { loading = false; }
    }
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [userId]);
  if (!today || snapshot?.userId !== userId) return null;
  const overdue = collectReturnTrades(snapshot.received, snapshot.sent, today).some(entry => entry.state.kind === 'overdue');
  return overdue ? <span role="img" aria-label="반납 기한을 초과한 물품이 있습니다" title="반납 기한 초과 물품이 있습니다" className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">!</span> : null;
}
