'use client';

import CampusMap from '@/components/CampusMap';
import { formatCampusLocation, nearestCampusBuilding, parseCampusLocation } from '@/lib/campus-location';

export default function TradeLocationPicker({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const { label, point } = parseCampusLocation(value);
  return <div>
    <label htmlFor="trade-location" className="mb-2 block text-sm font-bold text-slate-700">희망 거래 장소</label>
    <input id="trade-location" type="text" required maxLength={120} disabled={disabled} value={label}
      onChange={event => onChange(formatCampusLocation(event.target.value, point))}
      placeholder="예: 학생회관 정문 앞" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 disabled:opacity-60" />
    <p className="mt-2 text-sm text-slate-500">지도를 누르면 가장 가까운 건물 이름이 자동 입력됩니다. 정문·로비 등 만날 지점은 직접 수정해 주세요. 지도 선택은 생략할 수 있습니다.</p>
    <div className="mt-4"><CampusMap point={point} label={label} disabled={disabled} onChange={next => {
      const building = nearestCampusBuilding(next);
      onChange(formatCampusLocation(building ? `${building.name} 부근` : label, next));
    }} /></div>
    {point && <button type="button" disabled={disabled} onClick={() => onChange(label)} className="mt-3 text-sm text-slate-600 underline">지도 위치 지우기</button>}
  </div>;
}
