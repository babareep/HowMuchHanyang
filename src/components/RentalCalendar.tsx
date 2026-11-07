'use client';

import { useState } from 'react';
import { koreaToday, rentalDays } from '@/lib/trades';

export interface ReservedRange { start_date: string; end_date: string }
export default function RentalCalendar({ min, max, reserved, start, end, onChange }: {
  min: string; max: string; reserved: ReservedRange[]; start: string; end: string;
  onChange: (start: string, end: string) => void;
}) {
  const lower = min > koreaToday() ? min : koreaToday();
  const [month, setMonth] = useState((start || lower).slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  function move(delta: number) {
    const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
    setMonth(date.toISOString().slice(0, 7));
  }
  const blocked = (date: string) => date < lower || date > max || reserved.some(r => r.start_date <= date && r.end_date >= date);
  function choose(date: string) {
    if (blocked(date)) return;
    if (!start || end || date < start) { onChange(date, ''); return; }
    if (reserved.some(r => r.start_date <= date && r.end_date >= start)) { onChange(date, ''); return; }
    onChange(start, date);
  }
  return <section aria-label="대여 날짜 캘린더" className="rounded-xl border border-slate-200 p-4">
    <div className="mb-4 flex items-center justify-between"><button type="button" aria-label="이전 달" disabled={month <= lower.slice(0, 7)} onClick={() => move(-1)} className="rounded px-3 py-2 disabled:opacity-30">←</button><h4 aria-live="polite" className="font-bold">{year}년 {monthNumber}월</h4><button type="button" aria-label="다음 달" disabled={month >= max.slice(0, 7)} onClick={() => move(1)} className="rounded px-3 py-2 disabled:opacity-30">→</button></div>
    <div className="grid grid-cols-7 gap-1 text-center">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day} className="py-2 text-xs text-slate-500">{day}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} />)}
      {Array.from({ length: count }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const booked = reserved.some(r => r.start_date <= date && r.end_date >= date);
        const selected = date === start || date === end;
        const between = start && end && date > start && date < end;
        return <button type="button" key={date} disabled={blocked(date)} aria-label={`${date}${booked ? ' 예약됨' : ''}`} aria-pressed={Boolean(selected || between)} onClick={() => choose(date)} className={`min-h-10 rounded-lg text-sm disabled:cursor-not-allowed ${selected ? 'bg-teal-700 font-bold text-white' : between ? 'bg-teal-100 text-teal-900' : booked ? 'bg-slate-200 text-slate-400 line-through' : 'text-slate-800 hover:bg-teal-50 disabled:text-slate-300'}`}>{i + 1}</button>;
      })}
    </div>
    <p className="mt-4 text-sm text-slate-600">시작일을 누른 뒤 종료일을 선택하세요. 같은 날짜를 두 번 누르면 1일입니다. 회색 취소선은 예약된 날입니다.</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><p>{start || '시작일 미선택'} ~ {end || '종료일 미선택'}{end && ` (${rentalDays(start, end)}일)`}</p><button type="button" className="text-teal-800 underline" onClick={() => onChange('', '')}>선택 지우기</button></div>
  </section>;
}
