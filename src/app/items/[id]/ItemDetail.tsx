'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/types/item';
import { itemStatusLabel } from '@/types/item';
import ItemImage from '@/components/ItemImage';

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<{ id: string; item: Item | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
        if (active) setResult({ id, item: error ? null : data, error: error ? '상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' : '' });
      } catch {
        if (active) setResult({ id, item: null, error: '네트워크 연결을 확인하고 다시 시도해 주세요.' });
      }
    }
    load();
    return () => { active = false; };
  }, [id, attempt]);

  const current = result?.id === id ? result : null;
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="font-semibold text-blue-700 hover:underline">← 상품 목록</Link>
        {!current ? <p role="status" className="py-12 text-slate-600">상품을 불러오는 중입니다...</p>
          : current.error ? <div role="alert" className="mt-6 rounded-xl bg-red-50 p-6 text-red-700">
            <p>{current.error}</p><button className="mt-3 underline" onClick={() => { setResult(null); setAttempt(n => n + 1); }}>다시 시도</button>
          </div>
          : !current.item ? <div className="mt-6 rounded-xl bg-white p-8"><h1 className="text-xl font-bold">상품을 찾을 수 없습니다.</h1><p className="mt-2 text-slate-600">삭제되었거나 현재 조회할 수 없는 상품입니다.</p></div>
          : <article className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ItemImage src={current.item.image_url} title={current.item.title} />
            <div className="flex gap-3 text-sm font-bold text-slate-600"><span>{current.item.trade_type === 'SALE' ? '판매' : '대여'}</span><span>{itemStatusLabel(current.item.status)}</span></div>
            <h1 className="text-3xl font-bold text-slate-900">{current.item.title}</h1>
            <p className="text-2xl font-bold text-blue-900">{current.item.price.toLocaleString()}원{current.item.trade_type === 'RENTAL' && <span className="text-base font-normal"> / 1일</span>}</p>
            <dl className="space-y-3 text-slate-700"><div><dt className="font-bold">거래 장소</dt><dd>{current.item.location}</dd></div>
              {current.item.trade_type === 'RENTAL' && <div><dt className="font-bold">대여 가능 기간</dt><dd>{current.item.rental_start_date ?? '미정'} ~ {current.item.rental_end_date ?? '미정'}</dd></div>}
            </dl>
            <section className="border-t border-slate-100 pt-5"><h2 className="mb-3 font-bold text-slate-900">상품 설명</h2><p className="whitespace-pre-wrap break-words text-slate-700">{current.item.description}</p></section>
          </article>}
      </div>
    </main>
  );
}
