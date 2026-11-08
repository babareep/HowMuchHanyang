'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function WritePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  // 폼 상태 관리
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tradeType, setTradeType] = useState('SALE');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('한양대 애지문 앞');
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');
  
  // ✨ [추가됨] 카카오톡 연락처 상태
  const [contactLink, setContactLink] = useState('');
  
  // 이미지 파일 관리
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 로그인 체크
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

  // 이미지 선택 시 미리보기 처리
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // 상품 등록 (DB + Storage)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) return alert('제목과 가격은 필수입니다.');
    if (tradeType === 'RENTAL' && (!rentalStartDate || !rentalEndDate)) {
      return alert('대여 상품은 대여 가능 기간을 설정해야 합니다.');
    }

    setIsSubmitting(true);

    try {
      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('items')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('items')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrlData.publicUrl;
      }

      // ✨ [수정됨] contact_link 추가 저장
      const newItem = {
        seller_id: user.id,
        title,
        description,
        trade_type: tradeType,
        price: parseInt(price),
        location,
        rental_start_date: tradeType === 'RENTAL' ? rentalStartDate : null,
        rental_end_date: tradeType === 'RENTAL' ? rentalEndDate : null,
        image_url: imageUrl,
        contact_link: contactLink, // 추가된 연락처 컬럼
        status: 'AVAILABLE'
      };

      const { error: dbError } = await supabase.from('items').insert([newItem]);
      if (dbError) throw dbError;

      alert('성공적으로 등록되었습니다!');
      router.push('/');
      
    } catch (error: any) {
      alert(`등록 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-2xl text-slate-400 hover:text-slate-800">←</button>
          <h1 className="text-xl font-extrabold text-slate-800">물품 등록하기</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          
          {/* 이미지 업로드 섹션 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">상품 사진</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 shrink-0 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex justify-center items-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="미리보기" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-slate-300">📷</span>
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange}
                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">거래 방식</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTradeType('SALE')} className={`flex-1 py-3 rounded-xl font-bold transition ${tradeType === 'SALE' ? 'bg-orange-100 text-orange-700 border-2 border-orange-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>판매</button>
              <button type="button" onClick={() => setTradeType('RENTAL')} className={`flex-1 py-3 rounded-xl font-bold transition ${tradeType === 'RENTAL' ? 'bg-teal-100 text-teal-700 border-2 border-teal-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>대여</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">제목</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="예) 전공 서적 팝니다" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">가격 {tradeType === 'RENTAL' && '(1일 기준)'}</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} required placeholder="숫자만 입력 (원)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800" />
          </div>

          {tradeType === 'RENTAL' && (
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-teal-800 mb-1">대여 가능 시작일</label>
                <input type="date" value={rentalStartDate} onChange={e => setRentalStartDate(e.target.value)} className="w-full bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm font-medium" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-teal-800 mb-1">대여 가능 종료일</label>
                <input type="date" value={rentalEndDate} onChange={e => setRentalEndDate(e.target.value)} className="w-full bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm font-medium" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">희망 거래 장소</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} required placeholder="예) 제1공학관 1층 로비" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">상세 설명</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="물품 상태, 사용 기간 등을 자세히 적어주세요." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 resize-none"></textarea>
          </div>

          {/* ✨ [추가됨] 연락처 입력 폼 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              카카오톡 ID 또는 오픈채팅 링크 <span className="text-blue-500 text-xs font-normal">(거래 승인 시에만 구매자에게 노출됩니다)</span>
            </label>
            <input 
              type="text" 
              value={contactLink} 
              onChange={e => setContactLink(e.target.value)} 
              placeholder="예) 카톡 아이디 hanyang123 또는 오픈채팅 주소" 
              className="w-full bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-yellow-400 font-medium" 
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-black text-white font-black text-lg py-4 rounded-xl shadow-md transition disabled:bg-slate-300 mt-4">
            {isSubmitting ? '업로드 중...' : '등록 완료하기'}
          </button>
        </form>
      </main>
    </div>
  );
}