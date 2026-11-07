import type { Item } from '@/types/item';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export interface TradeRequest {
  id: string;
  item_id: string;
  buyer_id: string;
  status: RequestStatus;
  rental_start_date: string | null;
  rental_end_date: string | null;
  created_at: string;
}
export interface RequestWithItem extends TradeRequest { item: Item | null }
export const requestLabels: Record<RequestStatus, string> = {
  PENDING: '승인 대기', APPROVED: '승인됨', REJECTED: '거절됨', COMPLETED: '완료',
};
export function rentalDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
  return Number.isInteger(days) && days > 0 ? days : 0;
}
export function koreaToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}
export function canApprove(item: Item, request: TradeRequest): boolean {
  return request.status === 'PENDING' && (item.status === 'AVAILABLE' || (item.trade_type === 'RENTAL' && item.status === 'RESERVED'));
}
export function tradeError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'PGRST202' || code === '42883') return '거래 기능을 준비 중입니다. 잠시 후 다시 시도해 주세요.';
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : '연결을 확인하고 다시 시도해 주세요.';
}
