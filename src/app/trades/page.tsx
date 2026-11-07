'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { rentalDays, requestStatusLabel } from '@/lib/rental';

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
        // 1. 내가 올린 물품만 먼저 확실하게 가져오기
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('seller_id', session.user.id)
          .order('created_at', { ascending: false });

        if (itemsError) throw itemsError;
        const items = itemsData || [];

        // 2. 내 물품들의 ID만 추려내기
        const itemIds = items.map(item => item.id);

        // 3. 내 물품에 달린 요청들만 따로 가져오기 (JOIN 캐시 에러 원천 차단)
        let requests = [];
        if (itemIds.length > 0) {
          const { data: reqData, error: reqError } = await supabase
            .from('trade_requests')
            .select('*')
            .in('item_id', itemIds);
            
          if (reqError) throw reqError;
          requests = reqData || [];
        }

        // 4. 화면에 보여주기 위해 물품 카드 안에 요청 리스트 끼워넣기
        const combinedItems = items.map(item => ({
          ...item,
          trade_requests: requests
            .filter((req: any) => req.item_id === item.id)
            .sort((a: any, b: any) => (a.rental_start_date ?? '').localeCompare(b.rental_start_date ?? ''))
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

  // 요청 승인 처리
  const handleApprove = async (requestId: string, itemId: string) => {
    if (!confirm('이 요청을 승인하시겠습니까? (다른 요청들은 거절 처리됩니다)')) return;
    
    await supabase.from('trade_requests').update({ status: 'APPROVED' }).eq('id', requestId);
    await supabase.from('items').update({ status: 'RESERVED' }).eq('id', itemId);
    
    alert('승인되었습니다!');
    window.location.reload();
  };

  // 대여 요청 승인 / 거절 / 반납 확인 (DB 함수에서 권한·중복 기간을 원자적으로 검사)
  const runRentalAction = async (fn: string, requestId: string, ask: string, done: string) => {
    if (!confirm(ask)) return;
    const { error } = await supabase.rpc(fn, { p_request_id: requestId });
    if (error) {
      alert(`❌ ${error.message}`);
      return;
    }
    alert(done);
    window.location.reload();
  };

  // 판매 완료 처리
  const handleComplete = async (itemId: string) => {
    if (!confirm('거래를 최종 완료하시겠습니까?')) return;
    
    await supabase.from('items').update({ status: 'COMPLETED' }).eq('id', itemId);
    alert('거래가 완료되었습니다!');
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
                  <h2 className="text-lg font-bold text-slate-800">{item.title}</h2>
                  <p className="text-sm font-medium text-blue-600">{item.trade_type === 'RENTAL' ? `대여 · 1일 ${item.price?.toLocaleString()}원` : item.status === 'AVAILABLE' ? '거래 대기중' : item.status === 'RESERVED' ? '예약중 (거래 진행중)' : '거래 완료됨'}</p>
                </div>
                {item.trade_type === 'SALE' && item.status === 'RESERVED' && (
                  <button onClick={() => handleComplete(item.id)} className="bg-slate-800 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-slate-900 transition">
                    거래 최종 완료하기
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500">받은 요청 ({item.trade_requests?.length || 0}건)</h3>
                {item.trade_requests?.length === 0 ? (
                  <p className="text-sm text-slate-400">아직 들어온 요청이 없습니다.</p>
                ) : (
                  item.trade_requests?.map((req: any) => (
                    <div key={req.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="text-sm font-medium text-slate-700">
                        <div>{requestStatusLabel(req.status)}</div>
                        {item.trade_type === 'RENTAL' && req.rental_start_date && (
                          <div className="text-slate-500">
                            {req.rental_start_date} ~ {req.rental_end_date} · {rentalDays(req.rental_start_date, req.rental_end_date)}일 ·{' '}
                            {(item.price * rentalDays(req.rental_start_date, req.rental_end_date)).toLocaleString()}원
                          </div>
                        )}
                      </div>

                      {item.trade_type === 'RENTAL' ? (
                        <div className="flex gap-2">
                          {req.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => runRentalAction('approve_rental_request', req.id, `${req.rental_start_date} ~ ${req.rental_end_date} 대여를 승인하시겠습니까?`, '승인되었습니다!')}
                                className="bg-blue-600 text-white font-bold px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => runRentalAction('reject_rental_request', req.id, '이 요청을 거절하시겠습니까?', '거절되었습니다.')}
                                className="bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-sm hover:bg-slate-300"
                              >
                                거절
                              </button>
                            </>
                          )}
                          {req.status === 'APPROVED' && (
                            <button
                              onClick={() => runRentalAction('complete_rental_request', req.id, '물품 반납을 확인하셨습니까?', '반납 완료 처리되었습니다!')}
                              className="bg-slate-800 text-white font-bold px-3 py-2 rounded-lg text-sm hover:bg-slate-900"
                            >
                              반납 확인
                            </button>
                          )}
                        </div>
                      ) : (
                        item.status === 'AVAILABLE' && req.status === 'PENDING' && (
                          <button onClick={() => handleApprove(req.id, item.id)} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                            승인하기
                          </button>
                        )
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}