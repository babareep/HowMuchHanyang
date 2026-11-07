import { Suspense } from 'react';
import ItemDetail from './ItemDetail';

export default function ItemDetailPage() {
  return <Suspense fallback={<p role="status" className="p-10 text-center">상품을 불러오는 중입니다...</p>}><ItemDetail /></Suspense>;
}
