import React, { useState, useMemo, useCallback } from 'react';
import { 
  Trello, Plus, Search, Filter, Clock, User, 
  Tag, Trash2, Edit3, ArrowLeft, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { useKanbanTasks } from '../hooks/useKanbanTasks';
import { useJournal } from '../context/JournalProvider';
import { useTeamAccess } from '../hooks/useTeamAccess';
import { navigateAppModule } from '../hooks/useAppModule';
import { resolveMemberCategories } from '../utils/journalMemberPrefs';
import './KanbanPage.css';

const CATEGORIES = {
  edu: { label: '교육', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.08)' },
  prep: { label: '교육 준비', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)' },
  ai: { label: 'AI', color: '#db2777', bg: 'rgba(219, 39, 119, 0.08)' },
  other: { label: '기타', color: '#475569', bg: 'rgba(71, 85, 105, 0.08)' },
};

const MEMBERS = {
  A: '김윤형 (A)',
  B: '최우성 (B)',
  C: '신혜윤 (C)',
  unassigned: '미지정',
};

const COLUMNS = [
  { id: 'todo', title: '해야 할 일', color: '#7a7a7a' },
  { id: 'in_progress', title: '진행 중', color: '#0066cc' },
  { id: 'done', title: '완료', color: '#248a3d' },
];

export default function KanbanPage() {
  const { tasks, addTask, updateTask, deleteTask, moveTask, resetTasks, clearTasks } = useKanbanTasks();
  const { memberJournals, updateDay } = useJournal();
  const { isAdmin, scopedMember } = useTeamAccess();

  const isPilotUser = Boolean(scopedMember);
  const hasFullControl = isAdmin;
  const canCreateTask = hasFullControl || isPilotUser;

  const canModifyTask = (task) => {
    if (hasFullControl) return true;
    if (isPilotUser && task) {
      return task.assignee === scopedMember || task.assignee === 'unassigned';
    }
    return false;
  };

  const getMemberCategoryLabel = useCallback((categoryKey, memberCode) => {
    const targetCode = memberCode && memberCode !== 'unassigned' ? memberCode : (scopedMember || 'A');
    const prefs = memberJournals?.[targetCode]?.prefs;
    const catView = resolveMemberCategories(prefs);
    return catView.cats[categoryKey]?.label || CATEGORIES[categoryKey]?.label || categoryKey;
  }, [memberJournals, scopedMember]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null); // null means creating new
  const [modalTitle, setModalTitle] = useState('');
  const [modalAssignee, setModalAssignee] = useState('unassigned');
  const [modalCategory, setModalCategory] = useState('other');
  const [modalPlanHours, setModalPlanHours] = useState('0');
  const [modalNotes, setModalNotes] = useState('');

  const isModalEditable = activeTask ? canModifyTask(activeTask) : canCreateTask;

  // Journal Quick Log state
  const [logDate, setLogDate] = useState('');
  const [logPlanHours, setLogPlanHours] = useState('0');
  const [logActualHours, setLogActualHours] = useState('1');
  const [logSlot, setLogSlot] = useState('any');

  const currentWeekDates = useMemo(() => {
    const current = new Date();
    const day = current.getDay(); // 0 is Sun, 1 is Mon, ...
    const monDiff = day === 0 ? -6 : 1 - day; // diff to Monday
    const monday = new Date(current);
    monday.setDate(current.getDate() + monDiff);

    const days = [];
    const dayLabels = ['월', '화', '수', '목', '금'];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        date: dateStr,
        label: `${dateStr} (${dayLabels[i]})`,
      });
    }
    return days;
  }, []);

  // Extract unique task titles from member's daily journal to autocomplete task titles
  const existingJournalTaskTitles = useMemo(() => {
    const titles = new Set();
    if (memberJournals && scopedMember) {
      const slice = memberJournals[scopedMember];
      if (slice && slice.days) {
        Object.values(slice.days).forEach((day) => {
          if (day && day.tasks) {
            day.tasks.forEach((t) => {
              if (t.title && t.title.trim()) {
                titles.add(t.title.trim());
              }
            });
          }
        });
      }
    }
    return Array.from(titles).sort();
  }, [memberJournals, scopedMember]);

  // Calculate actual hours logged in daily journals for a given Kanban task
  const getLoggedDetails = useMemo(() => {
    return (taskId, taskTitle) => {
      let totalActual = 0;
      const loggedMembers = new Set();
      
      if (memberJournals) {
        Object.entries(memberJournals).forEach(([memberCode, slice]) => {
          if (!slice || !slice.days) return;
          Object.values(slice.days).forEach((day) => {
            if (!day || !day.tasks) return;
            day.tasks.forEach((t) => {
              const isMatch = t.kanbanTaskId === taskId || 
                              (t.title && t.title.trim() === taskTitle.trim());
              if (isMatch) {
                totalActual += Number(t.actual) || 0;
                loggedMembers.add(memberCode);
              }
            });
          });
        });
      }
      return {
        actualHours: totalActual,
        members: Array.from(loggedMembers),
      };
    };
  }, [memberJournals]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchAssignee = filterAssignee === 'all' || t.assignee === filterAssignee;
      return matchSearch && matchAssignee;
    });
  }, [tasks, searchQuery, filterAssignee]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    let totalPlan = 0;
    let totalActual = 0;
    
    filteredTasks.forEach((t) => {
      totalPlan += t.planHours || 0;
      const { actualHours } = getLoggedDetails(t.id, t.title);
      totalActual += actualHours;
    });

    return { total, totalPlan, totalActual };
  }, [filteredTasks, getLoggedDetails]);

  const openAddModal = () => {
    if (!canCreateTask) return;
    setActiveTask(null);
    setModalTitle('');
    setModalAssignee(isPilotUser ? scopedMember : 'unassigned');
    setModalCategory('other');
    setModalPlanHours('0');
    setModalNotes('');
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setActiveTask(task);
    setModalTitle(task.title);
    setModalAssignee(task.assignee);
    setModalCategory(task.category);
    setModalPlanHours(String(task.planHours || 0));
    setModalNotes(task.notes || '');

    if (currentWeekDates.length > 0) {
      setLogDate(currentWeekDates[0].date);
    }
    setLogPlanHours(String(task.planHours || 0));
    setLogActualHours('1');
    setLogSlot('any');

    setModalOpen(true);
  };

  const handleSave = () => {
    if (!modalTitle.trim()) {
      alert('업무명을 입력해 주세요.');
      return;
    }

    const data = {
      title: modalTitle,
      assignee: modalAssignee,
      category: modalCategory,
      planHours: Number(modalPlanHours) || 0,
      notes: modalNotes,
    };

    if (activeTask) {
      if (!canModifyTask(activeTask)) return;
      updateTask(activeTask.id, data);
    } else {
      if (!canCreateTask) return;
      addTask(data);
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!canModifyTask(task)) return;
    if (window.confirm('이 업무 카드를 삭제하시겠습니까?')) {
      deleteTask(id);
      setModalOpen(false);
    }
  };

  const handleRegisterToJournal = () => {
    if (!activeTask || !scopedMember) return;
    if (!logDate) {
      alert('등록할 날짜를 선택해 주세요.');
      return;
    }

    const plan = Number(logPlanHours) || 0;
    const actual = Number(logActualHours) || 0;
    const newId = `t-${Date.now()}`;
    const newTask = {
      id: newId,
      cat: activeTask.category || 'other',
      title: activeTask.title.trim(),
      plan,
      actual,
      done: activeTask.status === 'done',
      note: '',
      mmAxis: activeTask.category === 'ai' ? 'improve' : 'work',
      slot: logSlot === 'any' ? undefined : logSlot,
      kanbanTaskId: activeTask.id,
    };

    try {
      updateDay(logDate, (day) => {
        const tasks = day.tasks || [];
        return {
          ...day,
          tasks: [...tasks, newTask],
        };
      }, scopedMember);
      alert(`"${activeTask.title}" 업무가 ${logDate} 일지에 등록되었습니다!`);
    } catch (e) {
      console.error(e);
      alert('일지 등록에 실패했습니다.');
    }
  };

  const canMoveCard = (task) => {
    return canModifyTask(task);
  };

  const handleMove = (id, currentStatus, direction) => {
    const task = tasks.find(t => t.id === id);
    if (!canModifyTask(task)) return;
    const statusOrder = ['todo', 'in_progress', 'done'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextIndex = currentIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < statusOrder.length) {
      moveTask(id, statusOrder[nextIndex]);
    }
  };

  return (
    <main className="kanban-page">
      <header className="kanban-header">
        <div className="kanban-header__title">
          <Trello size={24} style={{ color: '#0066cc' }} />
          <div>
            <h2>업무 칸반 보드</h2>
            <p>팀 업무 현황을 시각화하고 일일 업무일지의 수행 시간과 연동하여 관리합니다.</p>
          </div>
        </div>
        <div className="kanban-header__actions">
          {canCreateTask && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={16} /> 카드 추가
            </button>
          )}
          {hasFullControl && (
            <div className="kanban-admin-settings" style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => {
                if (window.confirm("보드를 기본 샘플 카드로 초기화하시겠습니까?")) resetTasks();
              }}>
                샘플 리셋
              </button>
              <button className="btn btn-danger" onClick={() => {
                if (window.confirm("모든 업무 카드를 삭제하시겠습니까?")) clearTasks();
              }}>
                전체 삭제
              </button>
            </div>
          )}
          <span className="kanban-badge-role">
            {hasFullControl ? '관리자 모드' : isPilotUser ? `구성원 ${scopedMember} 모드 (본인 카드 이동/편집 가능)` : '조회 모드'}
          </span>
        </div>
      </header>

      {/* Stats Summary Panel */}
      <section className="kanban-stats">
        <div className="kanban-stats__grid">
          <article className="kanban-stats__card">
            <span>활성 카드 수</span>
            <strong>{stats.total}개</strong>
          </article>
          <article className="kanban-stats__card">
            <span>총 계획 시간</span>
            <strong>{stats.totalPlan}h</strong>
          </article>
          <article className="kanban-stats__card">
            <span>실제 누적 작업 시간 (일지 연동)</span>
            <strong style={{ color: stats.totalActual > 0 ? '#248a3d' : 'inherit' }}>
              {stats.totalActual}h
            </strong>
          </article>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="kanban-filter-bar">
        <div className="kanban-search">
          <Search size={16} className="kanban-search__icon" />
          <input 
            type="text" 
            placeholder="업무명 또는 설명 검색..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="kanban-filter">
          <Filter size={16} className="kanban-filter__icon" />
          <select 
            value={filterAssignee} 
            onChange={(e) => setFilterAssignee(e.target.value)}
          >
            <option value="all">담당자: 전체</option>
            <option value="A">김윤형 (A)</option>
            <option value="B">최우성 (B)</option>
            <option value="C">신혜윤 (C)</option>
            <option value="unassigned">미지정</option>
          </select>
        </div>
      </section>

      {/* Board Columns Area */}
      <section className="kanban-board">
        {COLUMNS.map((col) => {
          const columnTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="kanban-column">
              <h3 className="kanban-column__title" style={{ borderTop: `3px solid ${col.color}` }}>
                <span>{col.title}</span>
                <span className="kanban-column__count">{columnTasks.length}</span>
              </h3>
              
              <div className="kanban-column__cards">
                {columnTasks.length === 0 ? (
                  <div className="kanban-column__empty">업무가 없습니다</div>
                ) : (
                  columnTasks.map((task) => {
                    const { actualHours, members } = getLoggedDetails(task.id, task.title);
                    const catInfo = CATEGORIES[task.category] || CATEGORIES.other;
                    const canMove = canMoveCard(task);
                    
                    return (
                      <article 
                        key={task.id} 
                        className={`kanban-card${canMove ? ' is-draggable' : ''}`}
                        onClick={() => openEditModal(task)}
                      >
                        <div className="kanban-card__header">
                          <span 
                            className="kanban-card__tag" 
                            style={{ color: catInfo.color, backgroundColor: catInfo.bg }}
                          >
                            {getMemberCategoryLabel(task.category, task.assignee)}
                          </span>
                          <span className="kanban-card__assignee">
                            <User size={12} /> {MEMBERS[task.assignee] ? task.assignee : '미지정'}
                          </span>
                        </div>
                        
                        <h4 className="kanban-card__title">{task.title}</h4>
                        {task.notes && <p className="kanban-card__notes">{task.notes}</p>}
                        
                        <div className="kanban-card__hours">
                          <div className="kanban-hours-item" title="계획 시간">
                            <Clock size={12} />
                            <span>계획: {task.planHours}h</span>
                          </div>
                          {actualHours > 0 && (
                            <div className="kanban-hours-item is-actual" title="일지 연동 실제 누적 시간">
                              <CheckCircle2 size={12} />
                              <span>실제: {actualHours}h</span>
                            </div>
                          )}
                        </div>

                        {members.length > 0 && (
                          <div className="kanban-card__members">
                            {members.map(m => (
                              <span key={m} className="kanban-member-badge" title={`${MEMBERS[m] || m} 기록 완료`}>
                                {m}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Card Movement / Action Buttons */}
                        <div className="kanban-card__actions" onClick={(e) => e.stopPropagation()}>
                          <div className="kanban-card__move-buttons">
                            {col.id !== 'todo' && canMove && (
                              <button 
                                className="btn-move" 
                                title="이전 단계로 이동"
                                onClick={() => handleMove(task.id, col.id, -1)}
                              >
                                <ArrowLeft size={12} />
                              </button>
                            )}
                            {col.id !== 'done' && canMove && (
                              <button 
                                className="btn-move" 
                                title="다음 단계로 이동"
                                onClick={() => handleMove(task.id, col.id, 1)}
                              >
                                <ArrowRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Add / Edit Task Modal */}
      {modalOpen && (
        <div className="kanban-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="kanban-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{activeTask ? (isModalEditable ? '업무 카드 수정' : '업무 카드 상세보기') : '신규 업무 카드 생성'}</h3>
            
            <div className="form-group">
              <label>업무명</label>
              <input 
                type="text" 
                className="form-input" 
                value={modalTitle}
                disabled={!isModalEditable}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="수행할 핵심 업무명을 적어주세요..."
                list="existing-tasks-datalist"
              />
              <datalist id="existing-tasks-datalist">
                {existingJournalTaskTitles.map((title, idx) => (
                  <option key={idx} value={title} />
                ))}
              </datalist>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>담당자</label>
                <select 
                  className="form-input" 
                  value={modalAssignee}
                  disabled={!isModalEditable}
                  onChange={(e) => setModalAssignee(e.target.value)}
                >
                  {hasFullControl ? (
                    <>
                      <option value="unassigned">미지정</option>
                      <option value="A">김윤형 (A)</option>
                      <option value="B">최우성 (B)</option>
                      <option value="C">신혜윤 (C)</option>
                    </>
                  ) : (
                    <>
                      <option value="unassigned">미지정</option>
                      {scopedMember && (
                        <option value={scopedMember}>{MEMBERS[scopedMember] || scopedMember}</option>
                      )}
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>카테고리</label>
                <select 
                  className="form-input" 
                  value={modalCategory}
                  disabled={!isModalEditable}
                  onChange={(e) => setModalCategory(e.target.value)}
                >
                  <option value="edu">{getMemberCategoryLabel('edu', modalAssignee)}</option>
                  <option value="prep">{getMemberCategoryLabel('prep', modalAssignee)}</option>
                  <option value="ai">{getMemberCategoryLabel('ai', modalAssignee)}</option>
                  <option value="other">{getMemberCategoryLabel('other', modalAssignee)}</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>계획 시간 (h)</label>
              <input 
                type="number" 
                min="0"
                step="0.5"
                className="form-input" 
                value={modalPlanHours}
                disabled={!isModalEditable}
                onChange={(e) => setModalPlanHours(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>상세 설명 및 특이사항</label>
              <textarea 
                className="form-input" 
                rows="4"
                value={modalNotes}
                disabled={!isModalEditable}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="업무 세부 내용이나 관련 링크를 적어주세요..."
              />
            </div>

            {activeTask && (
              <div className="kanban-modal__log-summary">
                <strong>일지 누적 시간:</strong> {getLoggedDetails(activeTask.id, activeTask.title).actualHours}h
              </div>
            )}

            {activeTask && scopedMember && (
              <div className="kanban-modal__journal-log-section">
                <h4>⚡ 이 카드를 일일 업무일지에 즉시 등록</h4>
                <div className="form-group-row">
                  <div className="form-group">
                    <label>날짜 선택</label>
                    <select 
                      className="form-input" 
                      value={logDate} 
                      onChange={(e) => setLogDate(e.target.value)}
                    >
                      {currentWeekDates.map(d => (
                        <option key={d.date} value={d.date}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>시간대</label>
                    <select 
                      className="form-input" 
                      value={logSlot} 
                      onChange={(e) => setLogSlot(e.target.value)}
                    >
                      <option value="any">상관없음</option>
                      <option value="am">오전</option>
                      <option value="pm">오후</option>
                    </select>
                  </div>
                </div>
                <div className="form-group-row" style={{ marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label>계획 시간 (h)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.5"
                      className="form-input" 
                      value={logPlanHours} 
                      onChange={(e) => setLogPlanHours(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>실작업 시간 (h)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.5"
                      className="form-input" 
                      value={logActualHours} 
                      onChange={(e) => setLogActualHours(e.target.value)} 
                    />
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  style={{ 
                    marginTop: '0.75rem', 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.25rem',
                    backgroundColor: 'rgba(2, 132, 199, 0.08)',
                    borderColor: 'rgba(2, 132, 199, 0.3)',
                    color: '#0284c7',
                    fontWeight: '600'
                  }}
                  onClick={handleRegisterToJournal}
                >
                  <Plus size={14} /> 오늘/이번 주 일지에 등록
                </button>
              </div>
            )}

            <div className="modal-actions" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              {activeTask && canModifyTask(activeTask) && (
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  style={{ marginRight: 'auto' }}
                  onClick={() => handleDelete(activeTask.id)}
                >
                  <Trash2 size={14} /> 삭제
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setModalOpen(false)}
              >
                닫기
              </button>
              {isModalEditable && (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSave}
                >
                  저장
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Banner to link to Daily Work Journal */}
      {scopedMember && (
        <div 
          className="kanban-journal-link-banner" 
          onClick={() => navigateAppModule('journal')}
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: 'rgba(2, 132, 199, 0.05)',
            border: '1px solid rgba(2, 132, 199, 0.15)',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'background-color 0.2s ease, border-color 0.2s ease'
          }}
        >
          <Clock size={20} style={{ color: '#0284c7' }} />
          <span style={{ fontSize: '0.9rem', color: '#0369a1' }}>
            칸반 업무를 오늘 내 일일 업무일지에 기록하고 싶으신가요? <strong>일일 업무일지 작성 화면으로 바로 이동하기 ➔</strong>
          </span>
        </div>
      )}
    </main>
  );
}
