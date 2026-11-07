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
}

export function itemStatusLabel(status: string) {
  return ({ AVAILABLE: '거래 가능', RESERVED: '예약 중', COMPLETED: '거래 완료' } as Record<string, string>)[status] ?? status;
}

export type TradeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface TradeRequest {
  id: string;
  item_id: string;
  seller_id: string;
  requester_id: string;
  requester_email: string | null;
  trade_type: 'SALE' | 'RENTAL';
  status: TradeRequestStatus;
  created_at: string;
  updated_at: string;
  items?: Pick<Item, 'id' | 'title' | 'price' | 'status' | 'trade_type'> | null;
}

export function requestStatusLabel(status: string) {
  return ({ PENDING: '승인 대기', APPROVED: '승인됨', REJECTED: '거절됨', COMPLETED: '판매 완료' } as Record<string, string>)[status] ?? status;
}
