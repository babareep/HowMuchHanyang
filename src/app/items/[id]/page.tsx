'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TradeLocation from '@/components/TradeLocation';
import { supabase } from '@/lib/supabase';

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  
  const [id, setId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<any>(null);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // 대여(RENTAL) 전용 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentalDays, setRentalDays] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    params.then((resolvedParams) => setId(resolvedParams.id));
  }, [params]);

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

      if (currentUser && currentUser.id !== itemData.seller_id) {
        const { data: requestData } = await supabase
          .from('trade_requests')
          .select('*')
          .eq('item_id', id)
          .eq('buyer_id', currentUser.id)
          .maybeSingle();

        if (requestData) {
          setExistingRequest(requestData);
        }
      }
      setLoading(false);
    };

    loadData();
  }, [id, router]);

  // 대여 날짜가 변경될 때마다 일수와 총 금액 자동 계산
  useEffect(() => {
    if (startDate && endDate && item?.price) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start <= end) {
        // 같은 날이면 1일로 계산되도록 +1 처리
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setRentalDays(diffDays);
        setTotalPrice(diffDays * item.price);
      } else {
        setRentalDays(0);
        setTotalPrice(0);
      }
    }
  }, [startDate, endDate, item]);

  const handleRequestTrade = async () => {
    if (!user) return alert('로그인이 필요한 서비스입니다.');

    // 대여 상품일 경우 날짜 유효성 꼼꼼하게 검사
    if (item.trade_type === 'RENTAL') {
      if (!startDate || !endDate) return alert('대여 시작일과 종료일을 모두 선택해 주세요.');
      
      const selectedStart = new Date(startDate);
      const selectedEnd = new Date(endDate);
      const itemStart = new Date(item.rental_start_date);
      const itemEnd = new Date(item.rental_end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 오늘 날짜 00시 기준으로 맞춤

      if (selectedStart < today) return alert('과거 날짜는 선택할 수 없습니다.');
      if (selectedStart > selectedEnd) return alert('종료일이 시작일보다 빠를 수 없습니다.');
      if (selectedStart < itemStart || selectedEnd > itemEnd) {
        return alert(`판매자가 설정한 대여 가능 기간(${item.rental_start_date} ~ ${item.rental_end_date}) 내에서만 선택할 수 있습니다.`);
      }
    }

    if (confirm(`이 상품에 대한 ${item.trade_type === 'SALE' ? '구매' : '대여'} 요청을 보내시겠습니까?`)) {
      setRequesting(true);

      const newRequest = {
        item_id: item.id,
        buyer_id: user.id,
        status: 'PENDING',
        rental_start_date: item.trade_type === 'RENTAL' ? startDate : null,
        rental_end_date: item.trade_type === 'RENTAL' ? endDate : null,
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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">데이터를 불러오는 중...</div>;
  if (!item) return null;

  const isMyItem = user?.id === item.seller_id;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-2xl text-slate-400 hover:text-slate-800">←</button>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">상품 상세정보</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
          <div className="flex justify-between items-start mb-6">
            <span className={`text-sm px-3 py-1.5 rounded-md font-extrabold ${
              item.trade_type === 'SALE' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
            }`}>
              {item.trade_type === 'SALE' ? '판매' : '대여'}
            </span>
            {isMyItem && <span className="text-sm bg-blue-600 text-white font-bold px-3 py-1.5 rounded-full shadow-sm">내가 올린 물품</span>}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">{item.title}</h2>
          
          <div className="text-2xl font-black text-blue-900 mb-8 pb-6 border-b border-slate-100">
            {item.price?.toLocaleString()}원
            {item.trade_type === 'RENTAL' && <span className="text-sm text-slate-400 font-normal ml-2">/ 1일</span>}
          </div>

          <div className="space-y-6 text-slate-700">
            <div>
              <h3 className="text-sm font-bold text-slate-400 mb-1">상세 설명</h3>
              <p className="bg-slate-50 p-4 rounded-xl text-base leading-relaxed whitespace-pre-wrap">{item.description}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-400 mb-1">희망 거래 장소</h3>
              <TradeLocation value={item.location} />
            </div>
            {item.trade_type === 'RENTAL' && item.rental_start_date && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 mb-1">판매자 대여 가능 기간</h3>
                <p className="font-medium text-teal-700 bg-teal-50 px-4 py-2 rounded-lg inline-block">
                  📅 {item.rental_start_date} ~ {item.rental_end_date}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 렌탈 상품이고, 남의 물건이며, 거래 가능한 상태일 때만 노출되는 예약 폼 */}
        {item.trade_type === 'RENTAL' && !isMyItem && item.status === 'AVAILABLE' && !existingRequest && (
          <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-teal-900 mb-4">희망 대여 날짜 선택</h3>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-500 mb-1">시작일</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  min={item.rental_start_date}
                  max={item.rental_end_date}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-500 mb-1">종료일</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || item.rental_start_date}
                  max={item.rental_end_date}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800"
                />
              </div>
            </div>
            
            {rentalDays > 0 ? (
              <div className="bg-teal-50 p-4 rounded-xl flex justify-between items-center">
                <span className="font-bold text-teal-800">총 {rentalDays}일 대여 예상 금액</span>
                <span className="text-xl font-black text-teal-900">{totalPrice.toLocaleString()}원</span>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl text-center text-sm text-slate-400 font-medium">
                날짜를 선택하시면 총 대여 금액이 표시됩니다.
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-2xl mx-auto">
          {!user ? (
            <button disabled className="w-full bg-slate-200 text-slate-500 font-bold text-lg py-4 rounded-xl">로그인 후 요청할 수 있습니다</button>
          ) : isMyItem ? (
            <button disabled className="w-full bg-slate-100 border border-slate-300 text-slate-600 font-bold text-lg py-4 rounded-xl">내 물품입니다 (상태 변경은 '내 거래'에서 지원 예정)</button>
          ) : item.status !== 'AVAILABLE' ? (
            <button disabled className="w-full bg-slate-200 text-slate-500 font-bold text-lg py-4 rounded-xl">이미 거래가 완료되었거나 예약 중인 상품입니다</button>
          ) : existingRequest ? (
            <button disabled className="w-full bg-emerald-100 text-emerald-800 font-bold text-lg py-4 rounded-xl border border-emerald-200">
              {existingRequest.status === 'PENDING' ? '⏳ 이미 요청을 보냈습니다 (승인 대기 중)' : '✅ 승인된 거래입니다'}
            </button>
          ) : (
            <button 
              onClick={handleRequestTrade}
              disabled={requesting || (item.trade_type === 'RENTAL' && (!startDate || !endDate || rentalDays <= 0))}
              className="w-full bg-blue-600 disabled:bg-slate-300 hover:bg-blue-700 text-white font-black text-lg py-4 rounded-xl transition shadow-md"
            >
              {requesting ? '요청 전송 중...' : `${item.trade_type === 'SALE' ? '판매' : '대여'} 요청하기`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}