'use client';

import { Suspense, use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import Image from 'next/image';
import TradeLocationPicker from '@/components/TradeLocationPicker';
import { locationLabel } from '@/lib/campus-location';
import { supabase } from '@/lib/supabase';

// searchParams 접근은 Suspense 안에서 해야 /write 를 빌드 시 미리 렌더링할 수 있음
export default function WritePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  return (
    <Suspense fallback={<p role="status" className="p-8 text-center">페이지를 불러오는 중입니다...</p>}>
      <WriteForm searchParams={searchParams} />
    </Suspense>
  );
}

function WriteForm({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const router = useRouter();
  // ?edit=<상품 id> 로 들어오면 기존 글 수정 모드
  const editId = use(searchParams).edit ?? null;
  const isEdit = Boolean(editId);
  const [user, setUser] = useState<User | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [editLoaded, setEditLoaded] = useState(!isEdit);

  // 폼 상태 관리
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tradeType, setTradeType] = useState('SALE');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('한양대 애지문 앞');
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');

  // 이미지 파일 관리
  // 카카오톡 연락처 (거래 승인 시 구매자에게만 노출)
  const [contactLink, setContactLink] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  // 로그인 체크
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('로그인이 필요한 서비스입니다.');
        router.push('/');
        return;
      }
      if (editId) {
        const { data: item, error } = await supabase.from('items').select('*').eq('id', editId).maybeSingle();
        if (error || !item) {
          alert('존재하지 않거나 삭제된 상품입니다.');
          router.push('/');
          return;
        }
        if (item.seller_id !== session.user.id) {
          alert('내가 올린 물품만 수정할 수 있습니다.');
          router.push(`/items/${encodeURIComponent(editId)}`);
          return;
        }
        setTitle(item.title ?? '');
        setDescription(item.description ?? '');
        setTradeType(item.trade_type ?? 'SALE');
        setPrice(item.price != null ? String(item.price) : '');
        setLocation(item.location ?? '');
        setRentalStartDate(item.rental_start_date ?? '');
        setRentalEndDate(item.rental_end_date ?? '');
        setContactLink(item.contact_link ?? '');
        setExistingImageUrl(item.image_url ?? null);
        setImagePreview(item.image_url ?? null);
        setEditLoaded(true);
      }
      setUser(session.user);
    };
    checkUser();
  }, [router, editId]);

  // 이미지 선택 시 미리보기 처리
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      setImageFile(file);
      previewUrl.current = URL.createObjectURL(file);
      setImagePreview(previewUrl.current);
    }
  };

  // 상품 등록 (DB + Storage)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    if (!title.trim() || !price.trim() || !locationLabel(location).trim()) return alert('제목, 가격, 거래 장소를 입력해 주세요.');
    const amount = Number(price);
    if (!Number.isSafeInteger(amount) || amount < 0) return alert('가격은 0 이상의 정수로 입력해 주세요.');
    if (tradeType === 'RENTAL' && (!rentalStartDate || !rentalEndDate || rentalStartDate > rentalEndDate)) {
      return alert('대여 상품은 대여 가능 기간을 설정해야 합니다.');
    }

    setIsSubmitting(true);

    try {
      let imageUrl: string | null = existingImageUrl;

      // 1. 이미지가 선택되었다면 Supabase Storage에 먼저 업로드
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        // 파일명이 겹치지 않게 현재 시간과 랜덤 문자열 조합
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('items') // 방금 만든 버킷 이름
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        // 업로드 성공 후 이미지를 누구나 볼 수 있는 공용 URL 가져오기
        const { data: publicUrlData } = supabase.storage
          .from('items')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      const fields = {
        title: title.trim(),
        description: description.trim(),
        trade_type: tradeType,
        price: amount,
        location,
        rental_start_date: tradeType === 'RENTAL' ? rentalStartDate : null,
        rental_end_date: tradeType === 'RENTAL' ? rentalEndDate : null,
        image_url: imageUrl,
        contact_link: contactLink.trim() || null,
      };

      // 수정 모드: 기존 글 업데이트 (작성자 본인 글만)
      if (editId) {
        const { data: updated, error: updateError } = await supabase
          .from('items')
          .update(fields)
          .eq('id', editId)
          .eq('seller_id', user.id)
          .select('id');
        if (updateError) throw updateError;
        if (!updated || updated.length === 0) throw new Error('수정 권한이 없거나 상품을 찾을 수 없습니다.');
        alert('성공적으로 수정되었습니다!');
        router.push(`/items/${encodeURIComponent(editId)}`);
        return;
      }

      // 2. 알아낸 이미지 URL과 함께 items 테이블에 데이터 저장
      const newItem = {
        seller_id: user.id,
        seller_nickname: user.user_metadata?.nickname || '한양인', // ✨ 누락되었던 닉네임 저장 핵심 코드 추가 완료!
        title: title.trim(),
        description: description.trim(),
        trade_type: tradeType,
        price: amount,
        location,
        rental_start_date: tradeType === 'RENTAL' ? rentalStartDate : null,
        rental_end_date: tradeType === 'RENTAL' ? rentalEndDate : null,
        image_url: imageUrl, // 이미지 주소 추가!
        contact_link: contactLink.trim() || null, // 카카오톡 연락처
        status: 'AVAILABLE'
      };

      const { data, error: dbError } = await supabase.from('items').insert([newItem]).select('id').single();
      if (dbError) throw dbError;

      alert('성공적으로 등록되었습니다!');
      setTitle(''); setDescription(''); setTradeType('SALE'); setPrice('');
      setLocation('한양대 애지문 앞'); setRentalStartDate(''); setRentalEndDate('');
      setContactLink('');
      setImageFile(null); setImagePreview(null);
      if (previewUrl.current) { URL.revokeObjectURL(previewUrl.current); previewUrl.current = null; }
      if (fileInput.current) fileInput.current.value = '';
      router.push(`/items/${encodeURIComponent(data.id)}`);

    } catch (error: unknown) {
      alert(`${isEdit ? '수정' : '등록'} 실패: ${error && typeof error === 'object' && 'message' in error ? String(error.message) : '연결을 확인하고 다시 시도해 주세요.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !editLoaded) return <p role="status" className="p-8 text-center">{isEdit ? '상품 정보를 불러오는 중입니다...' : '로그인 상태를 확인하는 중입니다...'}</p>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push(editId ? `/items/${encodeURIComponent(editId)}` : '/')} className="text-2xl text-slate-400 hover:text-slate-800">←</button>
          <h1 className="text-xl font-extrabold text-slate-800">{isEdit ? '물품 수정하기' : '물품 등록하기'}</h1>
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
                  <Image src={imagePreview} alt="미리보기" width={96} height={96} unoptimized className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-slate-300">📷</span>
                )}
              </div>
              <input
                ref={fileInput}
                disabled={isSubmitting}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 기존 입력 폼들 */}
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
            <input type="number" min="0" step="1" value={price} onChange={e => setPrice(e.target.value)} required placeholder="숫자만 입력 (원)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800" />
          </div>

          {tradeType === 'RENTAL' && (
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-teal-800 mb-1">대여 가능 시작일</label>
                <input type="date" value={rentalStartDate} onChange={e => setRentalStartDate(e.target.value)} className="w-full bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm font-medium" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-teal-800 mb-1">대여 가능 종료일</label>
                <input type="date" min={rentalStartDate || undefined} value={rentalEndDate} onChange={e => setRentalEndDate(e.target.value)} className="w-full bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm font-medium" />
              </div>
            </div>
          )}

          <TradeLocationPicker value={location} onChange={setLocation} disabled={isSubmitting} />

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">상세 설명</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="물품 상태, 사용 기간 등을 자세히 적어주세요." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 resize-none"></textarea>
          </div>

          {/* 연락처 입력 폼 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              카카오톡 ID 또는 오픈채팅 링크 <span className="text-blue-500 text-xs font-normal">(거래 승인 시에만 구매자에게 노출됩니다)</span>
            </label>
            <input
              type="text"
              value={contactLink}
              onChange={e => setContactLink(e.target.value)}
              disabled={isSubmitting}
              placeholder="예) 카톡 아이디 hanyang123 또는 오픈채팅 주소"
              className="w-full bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-yellow-400 font-medium"
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-black text-white font-black text-lg py-4 rounded-xl shadow-md transition disabled:bg-slate-300 mt-4">
            {isSubmitting ? (isEdit ? '저장 중...' : '업로드 중...') : (isEdit ? '수정 완료하기' : '등록 완료하기')}
          </button>
        </form>
      </main>
    </div>
  );
}