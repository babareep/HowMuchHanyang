'use client';

import Image from 'next/image';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { mapPoint, type CampusPoint } from '@/lib/campus-location';

export default function CampusMap({ point, onChange, label, disabled = false }: {
  point: CampusPoint | null; onChange?: (point: CampusPoint) => void; label: string; disabled?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);
  const editable = Boolean(onChange) && !disabled;
  function choose(event: MouseEvent<HTMLButtonElement>) {
    // Keyboard-generated clicks have no pointer position; use the current pin.
    const next = event.detail === 0 ? point ?? { x: 50, y: 50 } : mapPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (next && editable && !imageError) onChange?.(next);
  }
  function movePin(event: KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = directions[event.key];
    if (!delta || !editable || imageError) return;
    event.preventDefault();
    const current = point ?? { x: 50, y: 50 };
    onChange?.({ x: Math.max(0, Math.min(100, current.x + delta[0])), y: Math.max(0, Math.min(100, current.y + delta[1])) });
  }
  const mapContent = <>
    <Image src="/maps/hanyang-seoul-2608.jpg" alt="한양대학교 서울캠퍼스 지도" fill sizes="(max-width: 768px) 100vw, 1100px" className="pointer-events-none select-none object-cover object-top" draggable={false} onError={() => setImageError(true)} />
    {point && !imageError && <span aria-hidden="true" style={{ left: `${point.x}%`, top: `${point.y}%` }} className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full drop-shadow-md"><svg width="34" height="42" viewBox="0 0 34 42"><path d="M17 40C14 35 2 24 2 17a15 15 0 1 1 30 0c0 7-12 18-15 23Z" fill="#dc2626" stroke="white" strokeWidth="2"/><circle cx="17" cy="16" r="5" fill="white"/></svg></span>}
  </>;
  return <div className="space-y-3 text-slate-800">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{onChange ? '지도에서 만날 위치를 눌러 주세요' : '거래 위치'}</p><div className="flex items-center gap-2"><button type="button" aria-label="지도 축소" disabled={zoom === 1} onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="rounded-lg border border-slate-300 bg-white px-3 py-1 disabled:opacity-30">−</button><span className="min-w-12 text-center text-xs" aria-live="polite">{zoom * 100}%</span><button type="button" aria-label="지도 확대" disabled={zoom === 3} onClick={() => setZoom(z => Math.min(3, z + 0.5))} className="rounded-lg border border-slate-300 bg-white px-3 py-1 disabled:opacity-30">＋</button></div></div>
    {imageError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">지도를 불러오지 못했습니다. 새로고침하거나 장소를 글로 입력해 주세요.</p>}
    <div className="max-h-[540px] overflow-auto rounded-xl border border-slate-200 bg-white">
      {/* This fixed crop excludes the original building legend. Never change its ratio without versioning stored pins. */}
      {onChange ? <button type="button" disabled={!editable || imageError} aria-label="거래 위치 선택 지도. 클릭하거나 방향키로 위치를 지정하세요." onClick={choose} onKeyDown={movePin} style={{ width: `${zoom * 100}%`, aspectRatio: '1008 / 1040' }} className="relative block shrink-0 cursor-crosshair overflow-hidden focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-blue-600">{mapContent}</button>
        : <div role="img" aria-label={`${label}의 거래 위치${point ? ' (빨간 핀)' : ''}`} style={{ width: `${zoom * 100}%`, aspectRatio: '1008 / 1040' }} className="relative overflow-hidden">{mapContent}</div>}
    </div>
    <p role="status" className="text-sm text-slate-600">{point ? '빨간 핀이 만날 위치입니다.' : '아직 지도 위치를 선택하지 않았습니다.'}{onChange && ' 확대 후 스크롤로 이동할 수 있습니다. 키보드는 지도에 초점을 맞추고 방향키를 사용하세요.'}</p>
    <div className="flex flex-wrap gap-4 text-xs text-blue-700"><a href="/maps/hanyang-seoul-2608.jpg" target="_blank" rel="noreferrer" className="underline">건물 목록 포함 원본 지도 ↗</a><a href="/maps/hanyang-seoul-barrier-free-260715.png" target="_blank" rel="noreferrer" className="underline">배리어프리 지도 참고 ↗</a></div>
  </div>;
}
