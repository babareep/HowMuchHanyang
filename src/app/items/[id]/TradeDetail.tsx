'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { Item } from '@/types/item';
import { koreaToday, rentalDays, tradeError, type TradeRequest } from '@/lib/trades';
import Link from 'next/link';
import ItemImage from '@/components/ItemImage';
import RentalCalendar, { type ReservedRange } from '@/components/RentalCalendar';
import { supabase } from '@/lib/supabase';

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  
  const { id } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [existingRequest, setExistingRequest] = useState<TradeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // 대여(RENTAL) 전용 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const days = rentalDays(startDate, endDate);
  const totalPrice = days * (item?.price ?? 0);
  const [loadError, setLoadError] = useState('');
  const [authVersion, setAuthVersion] = useState(0);
  const [reserved, setReserved] = useState<ReservedRange[]>([]);
  const [calendarError, setCalendarError] = useState('');

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setUser(null); setExistingRequest(null); setStartDate(''); setEndDate('');
        setAuthVersion(n => n + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);


  useEffect(() => {
    if (!id) return;
    let active = true;

    const loadData = async () => {
      setLoading(true); setLoadError(''); setExistingRequest(null); setReserved([]); setCalendarError('');
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!active) return;
      setUser(currentUser);

      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (!active) return;
      if (itemError || !itemData) {
        setLoadError('상품을 찾을 수 없거나 조회에 실패했습니다.');
        setLoading(false);
        return;
      }
      setItem(itemData);
      if (itemData.trade_type === 'RENTAL') {
        const { data: ranges, error: availabilityError } = await supabase.rpc('phase6_rental_availability', { p_item_id: id });
        if (!active) return;
        if (availabilityError) setCalendarError('예약 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        else setReserved(ranges ?? []);
      }

      if (currentUser && currentUser.id !== itemData.seller_id) {
        const { data: requestData, error: requestError } = await supabase
          .from('trade_requests')
          .select('*')
          .eq('item_id', id)
          .eq('buyer_id', currentUser.id)
          .in('status', ['PENDING', 'APPROVED'])
          .order('created_at', { ascending: false }).limit(1)
          .maybeSingle();

        if (!active) return;
        if (requestError) throw requestError;
        if (requestData) {
          setExistingRequest(requestData);
        }
      }
      setLoading(false);
    };

    loadData().catch(() => { if (active) { setLoadError('연결을 확인하고 다시 시도해 주세요.'); setLoading(false); } });
    return () => { active = false; };
  }, [id, router, authVersion]);

  const handleRequestTrade = async () => {
    if (!user || !item || requesting) return;
    if (item.seller_id === user.id) return;
    if (existingRequest) return;

    // 대여 상품일 경우 날짜 유효성 꼼꼼하게 검사
    if (item.trade_type === 'RENTAL') {
      if (!startDate || !endDate) return alert('대여 시작일과 종료일을 모두 선택해 주세요.');
      
      if (startDate < koreaToday()) return alert('과거 날짜는 선택할 수 없습니다.');
      if (startDate > endDate) return alert('종료일이 시작일보다 빠를 수 없습니다.');
      if (!item.rental_start_date || !item.rental_end_date || startDate < item.rental_start_date || endDate > item.rental_end_date) return alert('대여 가능 기간 내에서 선택해 주세요.');
    }

    if (confirm(`이 상품에 대한 ${item.trade_type === 'SALE' ? '구매' : '대여'} 요청을 보내시겠습니까?`)) {
      setRequesting(true);

      try {
        const { error } = await supabase.rpc('phase6_request_trade', {
          p_item_id: item.id,
          p_start_date: item.trade_type === 'RENTAL' ? startDate : null,
          p_end_date: item.trade_type === 'RENTAL' ? endDate : null,
        });
        if (error) throw error;
        router.push('/trades');
      } catch (cause) { alert(tradeError(cause)); }
      finally { setRequesting(false); }
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">데이터를 불러오는 중...</div>;
  if (loadError) return <main className="p-10 text-slate-900"><p role="alert">{loadError}</p><Link href="/" className="text-blue-700 underline">상품 목록으로</Link></main>;
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
        <Link href="/trades" className="font-bold text-blue-700 underline">내 거래 확인하기</Link>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
          <div className="flex justify-between items-start mb-6">
            <span className={`text-sm px-3 py-1.5 rounded-md font-extrabold ${
              item.trade_type === 'SALE' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
            }`}>
              {item.trade_type === 'SALE' ? '판매' : '대여'}
            </span>
            {isMyItem && <span className="text-sm bg-blue-600 text-white font-bold px-3 py-1.5 rounded-full shadow-sm">내가 올린 물품</span>}
          </div>

          <div className="mb-6"><ItemImage src={item.image_url} title={item.title} /></div>
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
              <p className="font-medium text-slate-800 flex items-center gap-2">📍 {item.location}</p>
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
        {item.trade_type === 'RENTAL' && !isMyItem && (item.status === 'AVAILABLE' || item.status === 'RESERVED') && !existingRequest && (
          <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-teal-900 mb-4">희망 대여 날짜 선택</h3>
            <div className="mb-6">
              {calendarError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{calendarError}<button className="ml-3 underline" onClick={() => setAuthVersion(n => n + 1)}>다시 시도</button></p>
                : item.rental_start_date && item.rental_end_date ? <RentalCalendar min={item.rental_start_date} max={item.rental_end_date} reserved={reserved} start={startDate} end={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); }} />
                : <p role="alert">대여 가능 기간이 설정되지 않았습니다.</p>}
            </div>

            {days > 0 ? (
              <div className="bg-teal-50 p-4 rounded-xl flex justify-between items-center">
                <span className="font-bold text-teal-800">총 {days}일 대여 예상 금액</span>
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
            <button disabled className="w-full bg-slate-100 border border-slate-300 text-slate-600 font-bold text-lg py-4 rounded-xl">내가 등록한 상품입니다</button>
          ) : (item.status !== 'AVAILABLE' && !(item.trade_type === 'RENTAL' && item.status === 'RESERVED')) ? (
            <button disabled className="w-full bg-slate-200 text-slate-500 font-bold text-lg py-4 rounded-xl">이미 거래가 완료되었거나 예약 중인 상품입니다</button>
          ) : existingRequest ? (
            <button disabled className="w-full bg-emerald-100 text-emerald-800 font-bold text-lg py-4 rounded-xl border border-emerald-200">
              {existingRequest.status === 'PENDING' ? '⏳ 이미 요청을 보냈습니다 (승인 대기 중)' : '✅ 승인된 거래입니다'}
            </button>
          ) : (
            <button 
              onClick={handleRequestTrade}
              disabled={requesting || (item.trade_type === 'RENTAL' && (Boolean(calendarError) || !startDate || !endDate || days <= 0))}
              className="w-full bg-blue-600 disabled:bg-slate-300 hover:bg-blue-700 text-white font-black text-lg py-4 rounded-xl transition shadow-md"
            >
              {requesting ? '요청 전송 중...' : `${item.trade_type === 'SALE' ? '구매' : '대여'} 요청하기`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}