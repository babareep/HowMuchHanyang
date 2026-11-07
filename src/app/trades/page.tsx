'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TradesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('로그인이 필요합니다.');
        router.push('/');
        return;
      }
      setUser(session.user);

      try {
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('seller_id', session.user.id)
          .order('created_at', { ascending: false });

        if (itemsError) throw itemsError;
        const items = itemsData || [];

        const itemIds = items.map(item => item.id);

        let requests = [];
        if (itemIds.length > 0) {
          const { data: reqData, error: reqError } = await supabase
            .from('trade_requests')
            .select('*')
            .in('item_id', itemIds);
            
          if (reqError) throw reqError;
          requests = reqData || [];
        }

        const combinedItems = items.map(item => ({
          ...item,
          trade_requests: requests.filter((req: any) => req.item_id === item.id)
        }));

        setMyItems(combinedItems);
      } catch (error: any) {
        alert(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // 날짜 간 일수 계산 함수 (대여일 경우 사용)
  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleApprove = async (requestId: string, itemId: string) => {
    if (!confirm('이 요청을 승인하시겠습니까? (다른 요청들은 자동 거절됩니다)')) return;
    
    await supabase.from('trade_requests').update({ status: 'APPROVED' }).eq('id', requestId);
    await supabase.from('items').update({ status: 'RESERVED' }).eq('id', itemId);
    
    alert('승인되었습니다!');
    window.location.reload();
  };

  const handleComplete = async (itemId: string, tradeType: string) => {
    const actionText = tradeType === 'RENTAL' ? '반납 처리를 완료' : '거래를 최종 완료';
    if (!confirm(`이 상품의 ${actionText}하시겠습니까?`)) return;
    
    await supabase.from('items').update({ status: 'COMPLETED' }).eq('id', itemId);
    alert('완료되었습니다!');
    window.location.reload();
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-2xl text-slate-400 hover:text-slate-800">←</button>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">내 거래 관리</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {myItems.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-xl border border-slate-100 text-slate-500">등록한 물품이 없습니다.</div>
        ) : (
          myItems.map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${item.trade_type === 'SALE' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                      {item.trade_type === 'SALE' ? '판매' : '대여'}
                    </span>
                    <h2 className="text-lg font-bold text-slate-800">{item.title}</h2>
                  </div>
                  <p className="text-sm font-medium text-blue-600">
                    {item.status === 'AVAILABLE' ? '거래 대기중' : item.status === 'RESERVED' ? '예약중 (진행중)' : '거래 완료됨'}
                  </p>
                </div>
                {item.status === 'RESERVED' && (
                  <button 
                    onClick={() => handleComplete(item.id, item.trade_type)} 
                    className={`font-bold px-4 py-2 rounded-lg text-sm transition ${
                      item.trade_type === 'RENTAL' 
                        ? 'bg-teal-700 hover:bg-teal-800 text-white' 
                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                    }`}
                  >
                    {item.trade_type === 'RENTAL' ? '반납 완료하기' : '판매 완료하기'}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500">받은 요청 ({item.trade_requests?.length || 0}건)</h3>
                {item.trade_requests?.length === 0 ? (
                  <p className="text-sm text-slate-400">아직 들어온 요청이 없습니다.</p>
                ) : (
                  item.trade_requests?.map((req: any) => {
                    const days = item.trade_type === 'RENTAL' ? calculateDays(req.rental_start_date, req.rental_end_date) : 0;
                    const totalPrice = days * item.price;

                    return (
                      <div key={req.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-slate-700">
                            {req.status === 'PENDING' ? '⏳ 승인 대기 중' : req.status === 'APPROVED' ? '✅ 승인된 요청' : '❌ 거절됨'}
                          </div>
                          {/* 대여 상품일 경우 요청 기간 및 예상 금액 추가 표시 */}
                          {item.trade_type === 'RENTAL' && req.rental_start_date && (
                            <div className="text-xs text-slate-500">
                              📅 희망 기간: {req.rental_start_date} ~ {req.rental_end_date} <br/>
                              💰 예상 수익: {days}일 ({totalPrice.toLocaleString()}원)
                            </div>
                          )}
                        </div>
                        
                        {item.status === 'AVAILABLE' && req.status === 'PENDING' && (
                          <button onClick={() => handleApprove(req.id, item.id)} className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg text-sm hover:bg-blue-700 shrink-0">
                            승인하기
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}