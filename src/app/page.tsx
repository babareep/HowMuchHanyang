'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import type { Item } from '@/types/item';
import { itemStatusLabel } from '@/types/item';
import ItemImage from '@/components/ItemImage';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    // 1. 로그인 상태 실시간 감지
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    
    // 2. 초기 로딩 시 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user || null);
    });

    // 3. 상품 목록 불러오기
    const fetchItems = async () => {
      try {
        const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
        if (error) setLoadError('상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        else setItems(data || []);
      } catch {
        setLoadError('네트워크 연결을 확인하고 다시 시도해 주세요.');
      } finally {
        setLoading(false);
      }
    };
    fetchItems();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 간편 로그인 (실패 시 에러 팝업 띄움)
  const handleQuickLogin = async (email: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'password1234!',
    });
    
    if (error) {
      alert(`❌ 로그인 실패!\n이유: ${error.message}\n(Supabase에 계정이 제대로 만들어졌는지, 비밀번호가 맞는지 확인해 주세요)`);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
      {/* 상단 헤더 */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <span className="text-2xl">🐾</span>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">얼마하냥</h1>
          </div>
          
          {user ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 hidden sm:inline-block">
                {user.email}
              </span>
              <button 
                onClick={() => router.push('/trades')} 
                className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
              >
                내 거래 관리
              </button>
              <button 
                onClick={handleLogout} 
                className="text-sm font-bold text-slate-400 hover:text-slate-800 transition"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="text-sm font-medium text-slate-400">로그인 대기 중...</div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* 로그인 버튼 섹션 */}
        {!user && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
            <h2 className="text-lg font-bold text-slate-800 mb-4">🚀 테스트 계정으로 시작하기</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => handleQuickLogin('user_a@hanyang.ac.kr')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-sm"
              >
                A 계정으로 로그인 (user_a)
              </button>
              <button 
                onClick={() => handleQuickLogin('user_b@hanyang.ac.kr')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-sm"
              >
                B 계정으로 로그인 (user_b)
              </button>
            </div>
          </div>
        )}

        {/* 상품 목록 섹션 */}
        <div className="flex justify-between items-end mb-4 px-1">
          <h2 className="text-xl font-bold text-slate-800">최근 올라온 물품</h2>
          <span className="text-sm font-medium text-slate-500">총 {items.length}개</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 font-medium animate-pulse">
            상품을 불러오는 중입니다...
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-xl bg-red-50 p-6 text-red-700">
            <p>{loadError}</p><button onClick={() => window.location.reload()} className="mt-3 underline">다시 시도</button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-500 shadow-sm">
            아직 등록된 물품이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <Link key={item.id} href={`/items/${encodeURIComponent(item.id)}`} className="block bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition focus-visible:outline-2 focus-visible:outline-blue-600">
                <div className="mb-4"><ItemImage src={item.image_url} title={item.title} /></div>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-extrabold ${
                    item.trade_type === 'SALE' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
                  }`}>
                    {item.trade_type === 'SALE' ? '판매' : '대여'}
                  </span>
                  <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                    {item.location}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">{item.description}</p>
                
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div className="text-lg font-black text-blue-900">
                    {item.price?.toLocaleString()}원
                    {item.trade_type === 'RENTAL' && <span className="text-xs text-slate-400 font-normal ml-1">/ 1일</span>}
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {itemStatusLabel(item.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 오른쪽 아래 둥둥 떠있는 글쓰기 버튼 (로그인 사용자만 보임) */}
      {user && (
        <button 
          onClick={() => router.push('/write')}
          className="fixed bottom-8 right-8 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 px-6 rounded-full shadow-xl transition transform hover:scale-105"
        >
          + 내 물품 등록하기
        </button>
      )}
    </div>
  );
}