import { Suspense } from 'react';
import TradeDetail from './TradeDetail';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status" className="p-10 text-center">상품을 불러오는 중입니다...</p>}><TradeDetail params={params} /></Suspense>;
}
