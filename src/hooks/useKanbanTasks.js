import { useState, useEffect, useCallback } from 'react';

const KANBAN_STORAGE_KEY = 'tms-kanban-tasks-v1';

const DEFAULT_KANBAN_TASKS = [
  {
    id: 'k-1',
    title: '신규 입사자 온보딩 교육 교재 개선',
    status: 'todo',
    assignee: 'A',
    category: 'edu',
    planHours: 8,
    notes: '온보딩 피드백을 분석하여 가독성이 떨어지는 파트를 전면 수정합니다.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'k-2',
    title: 'PPT 아카데마이저 템플릿 개발 및 동기화',
    status: 'in_progress',
    assignee: 'A',
    category: 'ai',
    planHours: 6,
    notes: '보고서 작성 효율을 극대화하기 위한 신규 레이아웃 템플릿 3종 추가.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'k-3',
    title: '팀 KPI v2 운영 모델 가이드 작성',
    status: 'done',
    assignee: 'unassigned',
    category: 'prep',
    planHours: 4,
    notes: 'OKESTRO 교육팀 상반기 운영 모델에 관한 매뉴얼 정리 완료.',
    createdAt: new Date().toISOString(),
  }
];

function loadKanbanTasks() {
  try {
    const raw = localStorage.getItem(KANBAN_STORAGE_KEY);
    if (!raw) return DEFAULT_KANBAN_TASKS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_KANBAN_TASKS;
  }
}

export function useKanbanTasks() {
  const [tasks, setTasks] = useState(loadKanbanTasks);

  useEffect(() => {
    localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = useCallback((taskData) => {
    const newTask = {
      id: `k-${Date.now()}`,
      title: taskData.title?.trim() || '새 업무 카드',
      status: taskData.status || 'todo',
      assignee: taskData.assignee || 'unassigned',
      category: taskData.category || 'other',
      planHours: Number(taskData.planHours) || 0,
      notes: taskData.notes || '',
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  }, []);

  const updateTask = useCallback((id, patch) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t))
    );
  }, []);

  const deleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const moveTask = useCallback((id, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
  }, []);

  const resetTasks = useCallback(() => {
    setTasks(DEFAULT_KANBAN_TASKS);
  }, []);

  const clearTasks = useCallback(() => {
    setTasks([]);
  }, []);

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    resetTasks,
    clearTasks,
  };
}
