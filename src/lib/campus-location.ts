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

// Building centers read from the supplied 2608 map (1008 x 1040 crop).
// These are visual proximity hints, not surveyed coordinates or walking distances.
export const campusBuildings = [
  ['101', '역사관', 574, 786], ['102', '본관', 523, 755],
  ['104', '애지문·한양대역 2번 출구', 521, 847], ['105', '한양플라자', 480, 798],
  ['106', '우체국', 457, 768], ['107', '학생회관', 434, 698],
  ['108', '국제관', 614, 901], ['109', '박물관', 636, 862],
  ['201', '재성토목관', 646, 959], ['202', '건축관', 689, 974],
  ['203', '과학기술관', 705, 936], ['204', '신소재공학관', 724, 890],
  ['206', '공업센터 본관', 757, 819], ['207', '공업센터 별관', 800, 794],
  ['208', '퓨전테크센터', 843, 759], ['209', '노천극장', 650, 804],
  ['210', '정몽구 미래자동차연구센터', 611, 739], ['211', '제2공학관', 700, 742],
  ['212', '제1공학관', 591, 696],
  ['213', '구자겸기계관', 899, 679], ['301', '대운동장', 813, 679],
  ['304', '산학기술관', 905, 593], ['305', 'IT/BT관', 901, 547],
  ['306', '올림픽체육관', 883, 459], ['401', '생활과학대학', 665, 622],
  ['402', '제1음악관', 718, 598], ['403', '제2음악관', 690, 597],
  ['405', '백남음악관', 716, 646], ['406', '학군단', 687, 685],
  ['407', '제1법학관', 736, 572], ['408', '제2법학관', 760, 598],
  ['409', '제3법학관', 792, 567], ['410', '경제금융대학·법학학술정보관', 790, 512],
  ['501', '백남학술정보관', 548, 631], ['503', '사자가 군것질할때 (사군)', 619, 678],
  ['504', '사회과학관', 480, 689], ['505', '사범대학 본관', 453, 595],
  ['506', '사범대학 별관', 411, 603], ['507', '자연과학대학', 372, 590],
  ['508', '인문관', 337, 678], ['604', '제1의학관', 272, 741],
  ['605', '제2의학관', 216, 684], ['606', '의과대학 본관', 239, 659],
  ['607', '동문회관', 128, 689], ['609', '병원서관', 236, 559],
  ['610', '병원본관', 260, 515], ['611', '권역응급의료센터', 297, 540],
  ['614', '병원동관·신한플라자', 309, 463], ['617', '간호미래교육관', 509, 501],
  ['618', '의예과강의동', 428, 445], ['619', '의생명융합연구센터', 404, 400],
  ['701', '한양종합기술연구원(HIT)', 599, 529], ['702', '한양사이버대학교 1관', 643, 557],
  ['703', '한양사이버대학교 2관', 689, 543], ['705', '융합교육관', 617, 476],
  ['706', '경영관', 663, 417], ['707', '행원파크', 722, 450],
  ['801', '제1학생생활관', 530, 416], ['802', '제3학생생활관', 461, 385],
  ['803', '제5학생생활관', 383, 451], ['804', '제2학생생활관', 662, 224],
  ['805', '개나리관', 627, 178], ['807', '게스트하우스', 512, 164],
  ['809', '제6학생생활관', 160, 178], ['810', '제7학생생활관', 223, 237],
  ['901', '한양여자대학교 본관', 691, 290], ['902', '한양여자대학교 디자인관', 739, 241],
  ['903', '한양여자대학교 도서관', 802, 286], ['904', '행원스퀘어', 782, 333],
  ['905', '한양초등학교', 837, 356], ['906', '한양여자대학교 교수회관', 752, 387],
  ['907', '한양여자대학교 정보문화관', 696, 362],
  ['908', '한양여자대학교 식품영양관', 628, 330],
  ['909', '한양여자대학교 유아교육관', 626, 267],
  ['main-gate', '정문', 304, 825], ['rear-gate', '후문', 949, 530],
].map(([id, name, x, y]) => ({ id: String(id), name: String(name), x: Number(x) / 1008 * 100, y: Number(y) / 1040 * 100 }));

export function nearestCampusBuilding(point: CampusPoint) {
  if (!isCampusPoint(point)) return null;
  // Compare actual image-space distances, accounting for the viewport aspect ratio.
  return campusBuildings.reduce((closest, building) => {
    const distance = (candidate: CampusPoint) => ((candidate.x - point.x) * 1008) ** 2 + ((candidate.y - point.y) * 1040) ** 2;
    return distance(building) < distance(closest) ? building : closest;
  });
}
