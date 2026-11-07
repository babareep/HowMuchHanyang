'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import ItemImage from '@/components/ItemImage';
import { supabase } from '@/lib/supabase';

export default function WritePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  
  // 폼 입력 상태 관리
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tradeType, setTradeType] = useState('SALE');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('한양대 내');
  
  // 대여(RENTAL) 전용 날짜 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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
    if (!user || saving) return;
    setFormError('');
    const amount = Number(price);
    if (!title.trim() || !description.trim() || !location.trim() || !price.trim()) {
      setFormError('제목, 설명, 가격, 장소를 입력해 주세요.'); return;
    }
    if (!Number.isSafeInteger(amount) || amount < 0) {
      setFormError('가격은 0 이상의 정수로 입력해 주세요.'); return;
    }
    if (tradeType === 'RENTAL' && (!startDate || !endDate || startDate > endDate)) {
      setFormError('올바른 대여 가능 시작일과 종료일을 입력해 주세요.'); return;
    }
    setSaving(true);

    // Supabase items 테이블 형식에 맞춰 데이터 묶기
    const newItem = {
      seller_id: user.id,
      title: title.trim(),
      description: description.trim(),
      trade_type: tradeType,
      price: amount,
      location: location.trim(),
      status: 'AVAILABLE',
      rental_start_date: tradeType === 'RENTAL' ? startDate : null,
      rental_end_date: tradeType === 'RENTAL' ? endDate : null,
    };

    try {
      const { data, error } = await supabase.from('items').insert([newItem]).select('id').single();
      if (error) {
        setFormError(`등록 실패: ${error.message}`);
      } else {
        // 라우터가 화면 상태를 보존하더라도 다음 등록은 초기값에서 시작합니다.
        setTitle('');
        setDescription('');
        setTradeType('SALE');
        setPrice('');
        setLocation('한양대 내');
        setStartDate('');
        setEndDate('');
        setFormError('');
        router.push(`/items/${encodeURIComponent(data.id)}`);
      }
    } catch {
      setFormError('등록 결과를 확인하지 못했습니다. 목록에서 등록 여부를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  // 로그인 확인 전까지 빈 화면 렌더링
  if (!user) return <p role="status" className="p-8 text-center">로그인 상태를 확인하는 중입니다...</p>;

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
          <div><ItemImage title="등록할 상품" /><p className="mt-2 text-sm text-slate-500">사진 없이도 기본 이미지로 상품을 등록할 수 있습니다.</p></div>
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
              <input required min="0" step="1" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 pr-10 bg-slate-50 focus:bg-white focus:outline-blue-500" placeholder="숫자만 입력" />
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
                <input required type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-teal-200 rounded-lg p-2 text-sm" />
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

          {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{formError}</p>}
          <button disabled={saving} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-4 rounded-xl transition shadow-md mt-4">
            {saving ? '저장 중...' : '물품 등록하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
