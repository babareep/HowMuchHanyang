'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function WritePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  // 폼 입력 상태 관리
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tradeType, setTradeType] = useState('SALE');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('한양대 내');
  
  // 대여(RENTAL) 전용 날짜 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 로그인 상태 확인 (비로그인 접근 차단)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('로그인이 필요한 서비스입니다.');
        router.push('/');
      } else {
        setUser(session.user);
      }
    };
    checkUser();
  }, [router]);

  // DB에 상품 등록하기
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Supabase items 테이블 형식에 맞춰 데이터 묶기
    const newItem = {
      seller_id: user.id,
      title,
      description,
      trade_type: tradeType,
      price: parseInt(price, 10),
      location,
      status: 'AVAILABLE',
      rental_start_date: tradeType === 'RENTAL' ? startDate : null,
      rental_end_date: tradeType === 'RENTAL' ? endDate : null,
    };

    const { error } = await supabase.from('items').insert([newItem]);

    if (error) {
      alert(`❌ 등록 실패: ${error.message}`);
    } else {
      alert('✅ 상품이 성공적으로 등록되었습니다!');
      router.push('/'); // 완료 후 메인 화면으로 복귀
    }
  };

  // 로그인 확인 전까지 빈 화면 렌더링
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black text-slate-800">상품 등록하기</h1>
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-slate-800 font-bold">
            ✕ 취소
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. 거래 유형 선택 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">어떤 거래를 하시겠습니까?</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition ${tradeType === 'SALE' ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold' : 'border-slate-200 text-slate-500'}`}>
                <input type="radio" value="SALE" className="hidden" checked={tradeType === 'SALE'} onChange={(e) => setTradeType(e.target.value)} />
                📦 판매 (SALE)
              </label>
              <label className={`flex-1 flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition ${tradeType === 'RENTAL' ? 'border-teal-500 bg-teal-50 text-teal-700 font-bold' : 'border-slate-200 text-slate-500'}`}>
                <input type="radio" value="RENTAL" className="hidden" checked={tradeType === 'RENTAL'} onChange={(e) => setTradeType(e.target.value)} />
                🤝 대여 (RENTAL)
              </label>
            </div>
          </div>

          {/* 2. 상품 이름 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">물품 이름</label>
            <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-blue-500" placeholder="예: 한양대 과잠 L사이즈" />
          </div>

          {/* 3. 가격 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{tradeType === 'SALE' ? '판매 가격' : '1일 대여료'}</label>
            <div className="relative">
              <input required type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 pr-10 bg-slate-50 focus:bg-white focus:outline-blue-500" placeholder="숫자만 입력" />
              <span className="absolute right-4 top-3 text-slate-400 font-medium">원</span>
            </div>
          </div>
          
          {/* 4. 대여 날짜 (대여일 때만 등장) */}
          {tradeType === 'RENTAL' && (
            <div className="flex gap-4 p-4 bg-teal-50 rounded-xl border border-teal-100">
              <div className="flex-1">
                <label className="block text-xs font-bold text-teal-800 mb-2">대여 시작 가능일</label>
                <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-teal-200 rounded-lg p-2 text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-teal-800 mb-2">대여 종료일</label>
                <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-teal-200 rounded-lg p-2 text-sm" />
              </div>
            </div>
          )}

          {/* 5. 거래 장소 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">선호하는 거래 장소</label>
            <input required type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-blue-500" />
          </div>

          {/* 6. 상세 설명 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">상세 설명</label>
            <textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-blue-500 resize-none" placeholder="물품 상태, 거래 가능 시간 등을 자세히 적어주세요." />
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-4 rounded-xl transition shadow-md mt-4">
            물품 등록하기
          </button>
        </form>
      </div>
    </div>
  );
}