export interface MapViewSize { width: number; height: number }
export interface MapPan { x: number; y: number }
export function canvasSize(view: MapViewSize, zoom: number): MapViewSize {
  const width = Math.min(view.width, view.height * 1008 / 1040) * zoom;
  return { width, height: width * 1040 / 1008 };
}
export function clampMapPan(pan: MapPan, view: MapViewSize, zoom: number): MapPan {
  const canvas = canvasSize(view, zoom);
  const maxX = Math.max(0, (canvas.width - view.width) / 2);
  const maxY = Math.max(0, (canvas.height - view.height) / 2);
  return { x: maxX === 0 ? 0 : Math.max(-maxX, Math.min(maxX, pan.x)), y: maxY === 0 ? 0 : Math.max(-maxY, Math.min(maxY, pan.y)) };
}
