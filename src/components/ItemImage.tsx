'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function ItemImage({ src, title }: { src?: string | null; title: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const validSource = src && /^https?:\/\//i.test(src) && src !== failedSource;
  return (
    <Image src={validSource ? src : '/item-placeholder.svg'} alt={validSource ? title : `${title} (기본 이미지)`}
      width={640} height={400} unoptimized className="aspect-[8/5] w-full rounded-xl bg-slate-100 object-cover"
      onError={() => setFailedSource(src ?? null)} />
  );
}
