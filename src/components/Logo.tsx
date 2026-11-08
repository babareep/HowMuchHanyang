type LogoMarkProps = {
  size?: number;
  className?: string;
};

// 얼마하냥 로고: 한양 블루 배지 위의 고양이 얼굴
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hmh-logo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#0E4A84" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#hmh-logo-bg)" />
      {/* 귀 */}
      <path d="M9.5 19 L10.5 8.5 L18 14.5 Z" fill="#fff" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30.5 19 L29.5 8.5 L22 14.5 Z" fill="#fff" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M11.8 15.5 L12.3 11.6 L15.2 13.9 Z" fill="#FDA4AF" />
      <path d="M28.2 15.5 L27.7 11.6 L24.8 13.9 Z" fill="#FDA4AF" />
      {/* 얼굴 */}
      <ellipse cx="20" cy="23.5" rx="12" ry="10" fill="#fff" />
      {/* 눈 */}
      <ellipse cx="15.6" cy="22.2" rx="1.6" ry="2" fill="#0E2A4F" />
      <ellipse cx="24.4" cy="22.2" rx="1.6" ry="2" fill="#0E2A4F" />
      {/* 코와 입 */}
      <path d="M18.6 25.6 h2.8 L20 27.2 Z" fill="#FB7185" stroke="#FB7185" strokeWidth="0.8" strokeLinejoin="round" />
      <path
        d="M20 27.2 v0.8 M20 28 q-1.2 1.3 -2.6 0.4 M20 28 q1.2 1.3 2.6 0.4"
        stroke="#0E2A4F"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={36} className="shadow-sm rounded-[11px]" />
      <span className="text-xl font-extrabold tracking-tight text-slate-800">
        얼마하<span className="text-blue-600">냥</span>
      </span>
    </span>
  );
}
