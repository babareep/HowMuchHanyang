'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import type { Item } from '@/types/item';
import { itemStatusLabel } from '@/types/item';
import ItemImage from '@/components/ItemImage';
import ReturnNavAlert from '@/features/returns/ReturnNavAlert';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // 한양대 이메일 직접 인증 상태
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

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

  // 한양대 도메인 검증 함수
  const validateHanyangEmail = (emailStr: string) => {
    return emailStr.trim().toLowerCase().endsWith('@hanyang.ac.kr');
  };

  // 직접 로그인 / 회원가입 핸들러
  const handleAuth = async (isSignUp: boolean) => {
    if (!inputEmail.trim() || !inputPassword.trim()) {
      alert('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    // 🔒 1순위 핵심 검증: @hanyang.ac.kr 계정인지 차단 검사
    if (!validateHanyangEmail(inputEmail)) {
      alert('❌ 가입/로그인 불가: 한양대학교 웹메일(@hanyang.ac.kr) 계정으로만 이용하실 수 있습니다.');
      return;
    }

    setAuthSubmitting(true);

    try {
      if (isSignUp) {
        // 회원가입
        const { error } = await supabase.auth.signUp({
          email: inputEmail.trim(),
          password: inputPassword,
        });
        if (error) throw error;
        alert('🎉 한양대 학생 인증 및 회원가입이 완료되었습니다!\n로그인해 주세요.');
      } else {
        // 로그인
        const { error } = await supabase.auth.signInWithPassword({
          email: inputEmail.trim(),
          password: inputPassword,
        });
        if (error) throw error;
        setInputEmail('');
        setInputPassword('');
      }
    } catch (err: any) {
      alert(`인증 실패: ${err.message}`);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // 해커톤 시연용 간편 로그인 (원클릭)
  const handleQuickLogin = async (email: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'password1234!',
    });
    
    if (error) {
      alert(`❌ 로그인 실패!\n이유: ${error.message}\n(Supabase에 계정이 등록되어 있는지 확인해 주세요)`);
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
                🎓 {user.email}
              </span>
              <button 
                onClick={() => router.push('/trades')} 
                className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
              >
                내 거래 관리 <ReturnNavAlert userId={user.id} />
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
        {/* 로그인 / 회원가입 섹션 (미로그인 시 노출) */}
        {!user && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-blue-700 font-black text-sm bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-md">
                  한양대 전용 인증
                </span>
                <h2 className="text-lg font-black text-slate-800">캠퍼스 학생 로그인</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                신뢰할 수 있는 학내 직거래를 위해 <strong>@hanyang.ac.kr</strong> 이메일만 허용됩니다.
              </p>
            </div>

            {/* 이메일 / 비밀번호 입력 폼 */}
            <div className="space-y-3">
              <input
                type="email"
                placeholder="한양대 이메일 입력 (예: student@hanyang.ac.kr)"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-600"
              />
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-600"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={authSubmitting}
                  onClick={() => handleAuth(false)}
                  className="flex-1 bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm transition disabled:bg-slate-300"
                >
                  로그인
                </button>
                <button
                  type="button"
                  disabled={authSubmitting}
                  onClick={() => handleAuth(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition disabled:bg-slate-300"
                >
                  새 한양인 회원가입
                </button>
              </div>
            </div>

            {/* 발표/심사용 빠른 테스트 계정 바로가기 */}
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                ⚡ 발표 심사용 원클릭 계정
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <button 
                  onClick={() => handleQuickLogin('user_a@hanyang.ac.kr')}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-lg text-xs transition"
                >
                  A 계정 (user_a@hanyang.ac.kr)
                </button>
                <button 
                  onClick={() => handleQuickLogin('user_b@hanyang.ac.kr')}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-lg text-xs transition"
                >
                  B 계정 (user_b@hanyang.ac.kr)
                </button>
              </div>
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

      {/* 오른쪽 아래 글쓰기 플로팅 버튼 */}
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