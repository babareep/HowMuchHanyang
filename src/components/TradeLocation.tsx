'use client';

import CampusMap from '@/components/CampusMap';
import { parseCampusLocation } from '@/lib/campus-location';

export default function TradeLocation({ value }: { value: string }) {
  const { label, point } = parseCampusLocation(value);
  return <div className="space-y-3"><p className="whitespace-pre-wrap break-words font-medium text-slate-800">📍 {label}</p>{point && <CampusMap point={point} label={label} />}</div>;
}
