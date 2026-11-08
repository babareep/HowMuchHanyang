'use client';

import { isReturnComplete } from '@/features/returns/return-status';
import { ReturnManagementProvider, ReturnDashboard, ReturnNotice } from '@/features/returns/ReturnManagement';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { locationLabel } from '@/lib/campus-location';
import { supabase } from '@/lib/supabase';

type TabType = 'MY_ITEMS' | 'RECEIVED' | 'SENT';

export default function TradesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('RECEIVED');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [myItems, setMyItems] = useState<any[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [completingItemId, setCompletingItemId] = useState<string | null>(null);
  const completing = useRef(false);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const loadAllTradeData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('로그인이 필요한 페이지입니다.');
      router.push('/');
      return;
    }
    const currentUser = session.user;
    setUser(currentUser);

    try {
      // 1. 내가 등록한 상품 가져오기
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('seller_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      const items = itemsData || [];
      setMyItems(items);

      // 2. 내가 받은 요청 가져오기
      const myItemIds = items.map((i) => i.id);
      if (myItemIds.length > 0) {
        const { data: recData, error: recError } = await supabase
          .from('trade_requests')
          .select('*')
          .in('item_id', myItemIds)
          .order('created_at', { ascending: false });

        if (recError) throw recError;

        const mappedReceived = (recData || []).map((req) => ({
          ...req,
          item: items.find((i) => i.id === req.item_id),
        }));
        setReceivedRequests(mappedReceived);
      } else {
        setReceivedRequests([]);
      }

      // 3. 내가 보낸 요청 가져오기
      const { data: sentData, error: sentError } = await supabase
        .from('trade_requests')
        .select('*')
        .eq('buyer_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;

      const sentItemIds = (sentData || []).map((s) => s.item_id);
      if (sentItemIds.length > 0) {
        const { data: targetItems, error: targetError } = await supabase
          .from('items')
          .select('*')
          .in('id', sentItemIds);

        if (targetError) throw targetError;

        const mappedSent = (sentData || []).map((req) => ({
          ...req,
          item: (targetItems || []).find((i) => i.id === req.item_id),
        }));
        setSentRequests(mappedSent);
      } else {
        setSentRequests([]);
      }
    } catch (err: any) {
      alert(`데이터를 불러오지 못했습니다: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTradeData();
  }, [router]);

  // 상품 상세에서 돌아왔을 때 이전 탭(?tab=MY_ITEMS 등) 복원
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'MY_ITEMS' || tab === 'RECEIVED' || tab === 'SENT') {
      setActiveTab(tab);
    }
  }, []);

  const handleApprove = async (requestId: string, itemId: string) => {
    if (!confirm('이 요청을 승인하시겠습니까? (거래가 예약 상태로 변경됩니다)')) return;

    await supabase.from('trade_requests').update({ status: 'APPROVED' }).eq('id', requestId);
    await supabase.from('items').update({ status: 'RESERVED' }).eq('id', itemId);

    alert('승인되었습니다.');
    loadAllTradeData();
  };

  const handleReject = async (requestId: string) => {
    if (!confirm('이 요청을 거절하시겠습니까?')) return;

    await supabase.from('trade_requests').update({ status: 'REJECTED' }).eq('id', requestId);

    alert('거절 처리되었습니다.');
    loadAllTradeData();
  };

  const handleComplete = async (itemId: string, tradeType: string) => {
    if (completing.current || !user || !myItems.some(item => item.id === itemId && item.seller_id === user.id)) return;
    const actionName = tradeType === 'RENTAL' ? '반납 완료' : '판매 완료';
    if (!confirm(`${actionName} 처리하시겠습니까?`)) return;
    completing.current = true; setCompletingItemId(itemId);
    try {
      // Keep the existing item-level completion contract; no DB changes or RPCs.
      const { data, error } = await supabase.from('items').update({ status: 'COMPLETED' })
        .eq('id', itemId).eq('seller_id', user.id).eq('status', 'RESERVED').select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('상태가 변경되었거나 처리 권한이 없습니다. 새로고침 후 확인해 주세요.');
      alert(`${actionName} 처리가 완료되었습니다.`);
      await loadAllTradeData();
    } catch (cause) {
      const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : '연결을 확인하고 다시 시도해 주세요.';
      alert(`완료 처리 실패: ${message}`);
    } finally { completing.current = false; setCompletingItemId(null); }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">거래 데이터를 불러오는 중...</div>;
  }

  return (
    <ReturnManagementProvider>
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-sm font-bold text-blue-600 hover:underline">
              ← 상품 목록
            </button>
          </div>
          <button 
            onClick={loadAllTradeData} 
            className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            새로고침
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-800">내 거래</h1>
          <p className="text-sm text-slate-500 mt-1">등록한 상품과 주고받은 거래 요청을 확인하세요.</p>
        </div>

        <ReturnDashboard received={receivedRequests} sent={sentRequests} onNavigate={setActiveTab} />

        {/* 3단 탭 */}
        <div className="grid grid-cols-3 gap-2 bg-slate-200 p-1 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('MY_ITEMS')}
            className={`py-2.5 text-sm font-bold rounded-lg transition ${
              activeTab === 'MY_ITEMS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            내가 등록한 상품 ({myItems.length})
          </button>
          <button
            onClick={() => setActiveTab('RECEIVED')}
            className={`py-2.5 text-sm font-bold rounded-lg transition ${
              activeTab === 'RECEIVED' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            받은 요청 ({receivedRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('SENT')}
            className={`py-2.5 text-sm font-bold rounded-lg transition ${
              activeTab === 'SENT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            보낸 요청 ({sentRequests.length})
          </button>
        </div>

        {/* 탭 1: 내가 등록한 상품 */}
        {activeTab === 'MY_ITEMS' && (
          <div className="space-y-4">
            {myItems.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400 font-medium border border-slate-100">
                등록한 상품이 없습니다.
              </div>
            ) : (
              myItems.map((item) => (
                <div
                  key={item.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/items/${item.id}?from=trades`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/items/${item.id}?from=trades`);
                    }
                  }}
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer transition hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-extrabold ${
                        item.trade_type === 'SALE' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {item.trade_type === 'SALE' ? '판매' : '대여'}
                      </span>
                      <h3 className="font-bold text-slate-800 text-lg">{item.title}</h3>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">
                      {item.price?.toLocaleString()}원 {item.trade_type === 'RENTAL' && '/ 1일'} · 📍 {locationLabel(item.location)}
                    </p>
                    <span className="inline-block mt-2 text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">
                      상태: {item.status === 'AVAILABLE' ? '거래 대기중' : item.status === 'RESERVED' ? '예약중 (진행중)' : '거래 완료됨'}
                    </span>
                  </div>

                  {item.status === 'RESERVED' && (
                    <button
                      disabled={completingItemId !== null}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleComplete(item.id, item.trade_type);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      className={`px-4 py-2 text-sm font-bold rounded-xl text-white transition ${
                        item.trade_type === 'RENTAL' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      {completingItemId === item.id ? '처리 중...' : item.trade_type === 'RENTAL' ? '반납 완료' : '판매 완료'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 탭 2: 받은 요청 */}
        {activeTab === 'RECEIVED' && (
          <div className="space-y-4">
            {receivedRequests.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400 font-medium border border-slate-100">
                받은 거래 요청이 없습니다.
              </div>
            ) : (
              receivedRequests.map((req) => {
                const days = req.rental_start_date ? calculateDays(req.rental_start_date, req.rental_end_date) : 0;
                const totalRentalPrice = days * (req.item?.price || 0);

                return (
                  <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">{req.item?.title || '상품 정보 없음'}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">요청 일시: {new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        isReturnComplete(req) || req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {isReturnComplete(req) ? '반납 완료' : req.status === 'COMPLETED' ? '거래 완료' : req.status === 'PENDING' ? '승인 대기' : req.status === 'APPROVED' ? '승인 완료' : '요청 거절됨'}
                      </span>
                    </div>

                    <ReturnNotice trade={req} owner />
                    <div className="bg-slate-50 p-4 rounded-xl text-sm font-medium text-slate-700 space-y-1">
                      <p>거래 방식: <span className="font-bold">{req.item?.trade_type === 'SALE' ? '판매' : '대여'}</span></p>
                      {req.rental_start_date && (
                        <>
                          <p>대여 희망 기간: <span className="font-bold text-teal-700">{req.rental_start_date} ~ {req.rental_end_date} ({days}일간)</span></p>
                          <p>예상 총 대여료: <span className="font-bold text-teal-800">{totalRentalPrice.toLocaleString()}원</span></p>
                        </>
                      )}
                      <p>희망 장소: 📍 {locationLabel(req.item?.location)}</p>
                    </div>

                    {req.status === 'PENDING' && req.item?.status === 'AVAILABLE' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleApprove(req.id, req.item_id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition"
                        >
                          승인하기
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold px-5 py-2.5 rounded-xl text-sm transition"
                        >
                          거절하기
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 탭 3: 보낸 요청 */}
        {activeTab === 'SENT' && (
          <div className="space-y-4">
            {sentRequests.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400 font-medium border border-slate-100">
                내가 보낸 요청이 없습니다.
              </div>
            ) : (
              sentRequests.map((req) => {
                const days = req.rental_start_date ? calculateDays(req.rental_start_date, req.rental_end_date) : 0;
                const totalRentalPrice = days * (req.item?.price || 0);

                return (
                  <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">{req.item?.title || '상품 정보 없음'}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">신청일: {new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        isReturnComplete(req) || req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {isReturnComplete(req) ? '반납 완료' : req.status === 'COMPLETED' ? '거래 완료' : req.status === 'PENDING' ? '승인 대기 중' : req.status === 'APPROVED' ? '거래 승인됨' : '요청 거절됨'}
                      </span>
                    </div>

                    <ReturnNotice trade={req} owner={false} />
                    <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 space-y-1">
                      <p>가격: <span className="font-bold text-slate-900">{req.item?.price?.toLocaleString()}원</span> {req.item?.trade_type === 'RENTAL' && '/ 1일'}</p>
                      {req.rental_start_date && (
                        <p>선택 대여 기간: <span className="font-bold text-teal-700">{req.rental_start_date} ~ {req.rental_end_date} (총 {totalRentalPrice.toLocaleString()}원)</span></p>
                      )}
                      <p>거래 장소: 📍 {locationLabel(req.item?.location)}</p>
                    </div>

                    {/* 승인 완료 시 판매자 카카오톡 연락처 노출 */}
                    {req.status === 'APPROVED' && req.item?.contact_link && (
                      <div className="mt-3 bg-yellow-100 border border-yellow-300 p-3 rounded-lg flex items-center gap-2">
                        <span className="text-xl">💬</span>
                        <div>
                          <p className="text-xs font-bold text-yellow-800 mb-0.5">판매자 연락처 (카카오톡 등)</p>
                          <p className="text-sm font-black text-slate-900 select-all">{req.item.contact_link}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
    </ReturnManagementProvider>
  );
}
