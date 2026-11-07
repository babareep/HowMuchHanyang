'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Item {
  id: string;
  title: string;
  price: number;
  trade_type: string;
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchItems() {
      try {
        const { data, error } = await supabase.from('items').select('*');
        if (error) throw error;
        setItems(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, []);

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🐾 얼마하냥? 테스트 목록</h1>

      {loading && <p className="text-gray-500">상품 목록을 불러오는 중...</p>}

      {error && (
        <p className="text-red-500 mb-4">데이터 불러오기 실패: {error}</p>
      )}

      {!loading && (
        <div className="space-y-3">
          {items && items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="border p-4 rounded-lg bg-white shadow-sm text-black">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold mr-2">
                  {item.trade_type}
                </span>
                <strong className="text-lg">{item.title}</strong>
                <p className="text-gray-600 mt-1">{item.price?.toLocaleString()}원</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500">등록된 상품이 없습니다.</p>
          )}
        </div>
      )}
    </main>
  );
}