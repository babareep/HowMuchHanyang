export interface CampusPoint { x: number; y: number }
// Coordinates are percentages of the fixed campus-map viewport, not GPS.
const marker = /\n\[HY-SEOUL-2608:(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\]$/;
export function isCampusPoint(point: CampusPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100;
}
export function parseCampusLocation(value?: string | null): { label: string; point: CampusPoint | null } {
  const text = value ?? '';
  const match = marker.exec(text);
  if (!match) return { label: text, point: null };
  const point = { x: Number(match[1]), y: Number(match[2]) };
  if (!isCampusPoint(point)) return { label: text, point: null };
  return { label: text.slice(0, match.index), point };
}
export function formatCampusLocation(label: string, point: CampusPoint | null): string {
  const cleanLabel = parseCampusLocation(label).label.trim();
  if (!point || !isCampusPoint(point)) return cleanLabel;
  return `${cleanLabel}\n[HY-SEOUL-2608:${point.x.toFixed(2)},${point.y.toFixed(2)}]`;
}
export function locationLabel(value?: string | null): string { return parseCampusLocation(value).label; }
export function mapPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): CampusPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: Math.round(Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)) * 100) / 100,
    y: Math.round(Math.max(0, Math.min(100, (clientY - rect.top) / rect.height * 100)) * 100) / 100 };
}
