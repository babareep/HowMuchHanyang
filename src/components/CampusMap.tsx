'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { canvasSize, clampMapPan, type MapPan } from '@/lib/map-viewport';
import { mapPoint, type CampusPoint } from '@/lib/campus-location';

export default function CampusMap({ point, onChange, label, disabled = false }: {
  point: CampusPoint | null; onChange?: (point: CampusPoint) => void; label: string; disabled?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<MapPan>({ x: 0, y: 0 });
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [imageError, setImageError] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; pan: MapPan; moved: boolean } | null>(null);
  const editable = Boolean(onChange) && !disabled;
  const size = canvasSize(viewSize, zoom);
  const boundedPan = clampMapPan(pan, viewSize, zoom);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function changeZoom(value: number) {
    const next = Math.max(1, Math.min(3, value));
    setZoom(next);
    setPan(clampMapPan({ x: boundedPan.x * next / zoom, y: boundedPan.y * next / zoom }, viewSize, next));
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || imageError || event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: boundedPan, moved: false };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const x = event.clientX - current.x, y = event.clientY - current.y;
    if (Math.hypot(x, y) > 5) { current.moved = true; setDragging(true); }
    if (current.moved) setPan(clampMapPan({ x: current.pan.x + x, y: current.pan.y + y }, viewSize, zoom));
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.moved || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5 || !editable || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const next = mapPoint(event.clientX, event.clientY, rect);
    if (next) onChange?.(next);
  }
  function movePin(event: KeyboardEvent<HTMLDivElement>) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = directions[event.key];
    if ((event.key === 'Enter' || event.key === ' ') && editable && !imageError) {
      event.preventDefault(); onChange?.(point ?? { x: 50, y: 50 }); return;
    }
    if (!delta || disabled || imageError) return;
    if (event.shiftKey || !onChange) {
      event.preventDefault();
      setPan(clampMapPan({ x: boundedPan.x - delta[0] * 30, y: boundedPan.y - delta[1] * 30 }, viewSize, zoom));
      return;
    }
    if (!editable) return;
    event.preventDefault();
    const current = point ?? { x: 50, y: 50 };
    onChange?.({ x: Math.max(0, Math.min(100, current.x + delta[0])), y: Math.max(0, Math.min(100, current.y + delta[1])) });
  }
  const mapContent = <>
    <Image src="/maps/hanyang-seoul-2608.jpg" alt="한양대학교 서울캠퍼스 지도" fill sizes="(max-width: 768px) 100vw, 1100px" className="pointer-events-none select-none object-cover object-top" draggable={false} onError={() => setImageError(true)} />
    {point && !imageError && <span aria-hidden="true" style={{ left: `${point.x}%`, top: `${point.y}%` }} className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full drop-shadow-md"><svg width="34" height="42" viewBox="0 0 34 42"><path d="M17 40C14 35 2 24 2 17a15 15 0 1 1 30 0c0 7-12 18-15 23Z" fill="#dc2626" stroke="white" strokeWidth="2"/><circle cx="17" cy="16" r="5" fill="white"/></svg></span>}
  </>;
  return <div className="space-y-3 text-slate-800">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{onChange ? '지도에서 만날 위치를 눌러 주세요' : '거래 위치'}</p><div className="flex items-center gap-2"><button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs">전체 보기</button><button type="button" aria-label="지도 축소" disabled={zoom === 1} onClick={() => changeZoom(zoom - 0.5)} className="rounded-lg border border-slate-300 bg-white px-3 py-1 disabled:opacity-30">−</button><span className="min-w-12 text-center text-xs" aria-live="polite">{zoom * 100}%</span><button type="button" aria-label="지도 확대" disabled={zoom === 3} onClick={() => changeZoom(zoom + 0.5)} className="rounded-lg border border-slate-300 bg-white px-3 py-1 disabled:opacity-30">＋</button></div></div>
    {imageError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">지도를 불러오지 못했습니다. 새로고침하거나 장소를 글로 입력해 주세요.</p>}
    <div ref={viewport} role="group" tabIndex={disabled ? -1 : 0} aria-label={onChange ? '거래 위치 지도. 클릭으로 핀 선택, 드래그로 이동, Shift와 방향키로 지도 이동.' : `${label}의 거래 위치 지도. 드래그 또는 방향키로 이동.`}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={() => { drag.current = null; setDragging(false); }}
      onLostPointerCapture={() => { drag.current = null; setDragging(false); }} onKeyDown={movePin}
      style={{ aspectRatio: '1008 / 1040', touchAction: 'none', cursor: dragging ? 'grabbing' : zoom > 1 ? 'grab' : editable ? 'crosshair' : 'default' }}
      className="relative w-full max-h-[540px] select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">
      {/* Keep the original fixed map crop and pin coordinate system while moving only the canvas. */}
      <div ref={canvas} style={{ width: size.width, height: size.height, left: '50%', top: '50%', transform: `translate(calc(-50% + ${boundedPan.x}px), calc(-50% + ${boundedPan.y}px))` }} className="absolute overflow-hidden">
        {mapContent}
      </div>
    </div>
    <p role="status" className="text-sm text-slate-600">{point ? '빨간 핀이 만날 위치입니다.' : '아직 지도 위치를 선택하지 않았습니다.'}{' ＋·− 버튼으로 지도만 확대하고, 지도를 끌어서 이동하세요.'}{onChange && ' 클릭하면 핀이 지정됩니다. 방향키로 핀, Shift+방향키로 지도를 움직일 수 있습니다.'}</p>
    <div className="flex flex-wrap gap-4 text-xs text-blue-700"><a href="/maps/hanyang-seoul-2608.jpg" target="_blank" rel="noreferrer" className="underline">건물 목록 포함 원본 지도 ↗</a><a href="/maps/hanyang-seoul-barrier-free-260715.png" target="_blank" rel="noreferrer" className="underline">배리어프리 지도 참고 ↗</a></div>
  </div>;
}
