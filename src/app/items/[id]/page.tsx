'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { kstToday, rentalDays, validateRentalRange, requestStatusLabel } from '@/lib/rental';

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  
  // URL 파라미터(id)를 상태로 관리하여 비동기 렌더링 충돌을 완벽히 방지합니다.
  const [id, setId] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<any>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // 1. params에서 id 값을 안전하게 꺼내옵니다.
  useEffect(() => {
    params.then((resolvedParams) => {
      setId(resolvedParams.id);
    });
  }, [params]);

  // 2. id가 세팅된 후에만 Supabase에서 데이터를 불러옵니다.
  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);

      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (itemError || !itemData) {
        alert('존재하지 않거나 삭제된 상품입니다.');
        router.push('/');
        return;
      }
      setItem(itemData);

      // 내 물건이 아니면 기존에 보낸 요청이 있는지 확인
      if (currentUser && currentUser.id !== itemData.seller_id) {
        const { data: requestData } = await supabase
          .from('trade_requests')
          .select('*')
          .eq('item_id', id)
          .eq('buyer_id', currentUser.id)
          .order('created_at', { ascending: false });

        setMyRequests(requestData ?? []);
      }
      
      setLoading(false);
    };

    loadData();
  }, [id, router]);

  const handleRequestTrade = async () => {
    if (!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    if (confirm(`이 상품에 대한 ${item.trade_type === 'SALE' ? '구매' : '대여'} 요청을 보내시겠습니까?`)) {
      setRequesting(true);

      const newRequest = {
        item_id: item.id,
        buyer_id: user.id,
        status: 'PENDING',
        rental_start_date: null,
        rental_end_date: null,
      };

      const { error } = await supabase.from('trade_requests').insert([newRequest]);

      setRequesting(false);

      if (error) {
        alert(`❌ 요청 실패: ${error.message}`);
      } else {
        alert('✅ 거래 요청이 성공적으로 전송되었습니다!\n판매자가 승인하면 거래가 진행됩니다.');
        window.location.reload(); 
      }
    }
  };

  // 대여 요청 (DB 함수에서 날짜·기간·권한을 다시 검증)
  const handleRentalRequest = async () => {
    if (!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }
    const message = validateRentalRange(startDate, endDate, item.rental_start_date, item.rental_end_date);
    if (message) {
      alert(message);
      return;
    }
    const days = rentalDays(startDate, endDate);
    const total = item.price * days;
    if (!confirm(`${startDate} ~ ${endDate} (${days}일)\n총 대여료 ${total.toLocaleString()}원 (안내용 · 실제 결제 없음)\n\n대여 요청을 보내시겠습니까?`)) return;

    setRequesting(true);
    const { error } = await supabase.rpc('create_rental_request', {
      p_item_id: item.id,
      p_start: startDate,
      p_end: endDate,
    });
    setRequesting(false);

    if (error) {
      alert(`❌ 요청 실패: ${error.message}`);
    } else {
      alert('✅ 대여 요청을 보냈습니다!\n판매자가 승인하면 예약이 확정됩니다.');
      window.location.reload();
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">데이터를 불러오는 중...</div>;
  }

  if (!item) return null;

  const isMyItem = user?.id === item.seller_id;
  const existingRequest = myRequests[0] ?? null; // 판매 상품용
  const today = kstToday();
  const minStart = item.rental_start_date && item.rental_start_date > today ? item.rental_start_date : today;
  const selectedDays = startDate && endDate && endDate >= startDate ? rentalDays(startDate, endDate) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-2xl text-slate-400 hover:text-slate-800">
            ←
          </button>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">상품 상세정보</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
          
          <div className="flex justify-between items-start mb-6">
            <span className={`text-sm px-3 py-1.5 rounded-md font-extrabold ${
              item.trade_type === 'SALE' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
            }`}>
              {item.trade_type === 'SALE' ? '판매' : '대여'}
            </span>
            
            {isMyItem && (
              <span className="text-sm bg-blue-600 text-white font-bold px-3 py-1.5 rounded-full shadow-sm">
                내가 올린 물품
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">{item.title}</h2>
          
          <div className="text-2xl font-black text-blue-900 mb-8 pb-6 border-b border-slate-100">
            {item.price?.toLocaleString()}원
            {item.trade_type === 'RENTAL' && <span className="text-sm text-slate-400 font-normal ml-2">/ 1일</span>}
          </div>

          <div className="space-y-6 text-slate-700">
            <div>
              <h3 className="text-sm font-bold text-slate-400 mb-1">상세 설명</h3>
              <p className="bg-slate-50 p-4 rounded-xl text-base leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 mb-1">희망 거래 장소</h3>
              <p className="font-medium text-slate-800 flex items-center gap-2">
                📍 {item.location}
              </p>
            </div>

            {item.trade_type === 'RENTAL' && item.rental_start_date && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 mb-1">대여 가능 기간</h3>
                <p className="font-medium text-teal-700 bg-teal-50 px-4 py-2 rounded-lg inline-block">
                  📅 {item.rental_start_date} ~ {item.rental_end_date}
                </p>
              </div>
            )}

            {item.trade_type === 'RENTAL' && myRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 mb-1">내 대여 요청</h3>
                <ul className="space-y-2">
                  {myRequests.map((req) => {
                    const days = rentalDays(req.rental_start_date, req.rental_end_date);
                    return (
                      <li key={req.id} className="flex justify-between bg-slate-50 px-4 py-2 rounded-lg text-sm">
                        <span>
                          {req.rental_start_date} ~ {req.rental_end_date} ({days}일 · {(item.price * days).toLocaleString()}원)
                        </span>
                        <span className="font-bold">{requestStatusLabel(req.status)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-2xl mx-auto">
          {!user ? (
            <button disabled className="w-full bg-slate-200 text-slate-500 font-bold text-lg py-4 rounded-xl">
              로그인 후 요청할 수 있습니다
            </button>
          ) : isMyItem ? (
            <button disabled className="w-full bg-slate-100 border border-slate-300 text-slate-600 font-bold text-lg py-4 rounded-xl">
              내 물품입니다 (상태 변경은 '내 거래'에서 지원 예정)
            </button>
          ) : item.trade_type === 'RENTAL' && item.status === 'AVAILABLE' ? (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <label className="flex-1 text-xs font-bold text-slate-500">
                  시작일
                  <input
                    type="date"
                    value={startDate}
                    min={minStart}
                    max={item.rental_end_date ?? undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
                  />
                </label>
                <label className="flex-1 text-xs font-bold text-slate-500">
                  종료일
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || minStart}
                    max={item.rental_end_date ?? undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
                  />
                </label>
              </div>
              {selectedDays > 0 && (
                <p className="text-sm text-slate-700">
                  {item.price.toLocaleString()}원 × {selectedDays}일 ={' '}
                  <b className="text-blue-900">{(item.price * selectedDays).toLocaleString()}원</b>
                  <span className="text-slate-400"> (안내용 · 실제 결제 없음)</span>
                </p>
              )}
              <button
                onClick={handleRentalRequest}
                disabled={requesting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-4 rounded-xl transition shadow-md"
              >
                {requesting ? '요청 전송 중...' : '대여 요청하기'}
              </button>
            </div>
          ) : item.status !== 'AVAILABLE' ? (
            <button disabled className="w-full bg-slate-200 text-slate-500 font-bold text-lg py-4 rounded-xl">
              이미 거래가 완료되었거나 예약 중인 상품입니다
            </button>
          ) : existingRequest ? (
            <button disabled className="w-full bg-emerald-100 text-emerald-800 font-bold text-lg py-4 rounded-xl border border-emerald-200">
              {existingRequest.status === 'PENDING' ? '⏳ 이미 요청을 보냈습니다 (승인 대기 중)' : '✅ 승인된 거래입니다'}
            </button>
          ) : (
            <button 
              onClick={handleRequestTrade}
              disabled={requesting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-4 rounded-xl transition shadow-md"
            >
              {requesting ? '요청 전송 중...' : `${item.trade_type === 'SALE' ? '판매' : '대여'} 요청하기`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}