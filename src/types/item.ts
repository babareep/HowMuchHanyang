export interface Item {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  trade_type: 'SALE' | 'RENTAL';
  price: number;
  location: string;
  status: string;
  rental_start_date: string | null;
  rental_end_date: string | null;
  image_url?: string | null;
  contact_link?: string | null;
}

export function itemStatusLabel(status: string) {
  return ({ AVAILABLE: '거래 가능', RESERVED: '예약 중', COMPLETED: '거래 완료' } as Record<string, string>)[status] ?? status;
}
