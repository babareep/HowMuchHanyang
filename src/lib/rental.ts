const DAY_MS = 86_400_000;

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function toUtc(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

/** 시작일·종료일 포함. 같은 날 = 1일 */
export function rentalDays(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1;
}

export function rentalTotal(pricePerDay: number, start: string, end: string): number {
  return pricePerDay * rentalDays(start, end);
}

/** 종료일 당일도 점유 */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function validateRentalRange(
  start: string, end: string,
  availableFrom: string | null, availableTo: string | null,
  today: string = kstToday(),
): string | null {
  if (!start || !end) return '대여 시작일과 종료일을 선택해 주세요.';
  if (start < today) return '과거 날짜는 선택할 수 없습니다.';
  if (end < start) return '종료일은 시작일보다 빠를 수 없습니다.';
  if ((availableFrom && start < availableFrom) || (availableTo && end > availableTo))
    return `상품 대여 가능 기간(${availableFrom} ~ ${availableTo}) 안에서 선택해 주세요.`;
  return null;
}

export const requestStatusLabel: Record<string, string> = {
  PENDING: '⏳ 승인 대기', APPROVED: '✅ 승인됨', REJECTED: '❌ 거절됨', COMPLETED: '📦 반납 완료',
};
