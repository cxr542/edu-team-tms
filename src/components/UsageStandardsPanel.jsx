import React from 'react';
import { Settings } from 'lucide-react';
import { DEFAULT_ATTENDEES } from '../constants/usageCategories';

/**
 * @param {{
 *   categories: Array<{ id: string, label: string, color: string, description: string }>,
 *   variant?: 'sidebar' | 'main',
 *   showManage?: boolean,
 *   onManage?: () => void,
 * }} props
 */
export default function UsageStandardsPanel({
  categories,
  variant = 'sidebar',
  showManage = false,
  onManage,
}) {
  return (
    <div className={`usage-standards-panel usage-standards-panel--${variant}`}>
      <h4 className="usage-standards-panel__title">사용 유형 기준표</h4>
      <table className="usage-standards-panel__table">
        <thead>
          <tr>
            <th scope="col">유형</th>
            <th scope="col">기준</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td className="usage-standards-panel__type" style={{ color: c.color }}>
                {c.label}
              </td>
              <td className="usage-standards-panel__desc">{c.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="usage-standards-panel__foot">
        참석자 미입력 시 「{DEFAULT_ATTENDEES}」로 기록됩니다.
      </p>
      {showManage && onManage && (
        <button type="button" className="btn btn-secondary usage-standards-panel__manage" onClick={onManage}>
          <Settings size={14} aria-hidden />
          사용 유형 관리
        </button>
      )}
    </div>
  );
}
