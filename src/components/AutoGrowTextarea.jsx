import React, { useLayoutEffect, useRef } from 'react';

/** 내용 길이에 맞춰 높이가 늘고 줄어드는 textarea (최소 rows 유지) */
export default function AutoGrowTextarea({ value, style, rows = 2, ...rest }) {
  const ref = useRef(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  useLayoutEffect(fit, [value]);

  useLayoutEffect(() => {
    // 창 너비가 바뀌면 줄바꿈이 달라지므로 다시 맞춘다
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      style={{ overflow: 'hidden', resize: 'none', ...style }}
      {...rest}
    />
  );
}
