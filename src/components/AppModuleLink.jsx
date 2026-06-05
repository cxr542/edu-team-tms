import React from 'react';
import { buildAppModuleUrl, navigateAppModule } from '../hooks/useAppModule';

/**
 * 모듈 간 이동 링크 — pathname(base) 유지 + SPA 전환
 */
export default function AppModuleLink({
  module,
  mode = 'edit',
  year,
  month,
  member,
  access,
  className,
  style,
  children,
  onNavigate,
  ...rest
}) {
  const href = buildAppModuleUrl(module, { mode, year, month, member, access });

  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        navigateAppModule(module, { mode, year, month, member, access });
        onNavigate?.();
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
