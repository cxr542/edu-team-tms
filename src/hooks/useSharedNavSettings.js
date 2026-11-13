import { useCallback, useEffect, useRef, useState } from 'react';
import { diffNavLabels } from '../utils/navOrder';
import { fetchNavSettings, saveNavSettings } from '../utils/navSettingsApi';

const SAVE_DEBOUNCE_MS = 800;

/**
 * 사이드바 메뉴 이름·순서를 팀 공유 저장소(Supabase)와 맞춘다.
 *  - 처음 열 때 공유 설정을 읽어 화면에 적용한다 (공유가 정본, 브라우저 저장은 연결이 안 될 때의 대비)
 *  - 관리자가 바꾸면(markChanged) 잠깐 모았다가 한 번에 저장한다
 *  - 공유 저장소에 닿지 못해도 화면은 브라우저 저장으로 그대로 동작한다
 * status: idle | loading | ready | empty | saving | saved | not-ready | error
 *
 * @param {{ enabled: boolean, labels: object, defaults: object, order: object, onRemote: (value: {order: object, labels: object}) => void }} options
 */
export function useSharedNavSettings({ enabled, labels, defaults, order, onRemote }) {
  const [state, setState] = useState({ status: 'idle', message: '', at: null });
  const [loaded, setLoaded] = useState(false);
  const [changeTick, setChangeTick] = useState(0);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const latestRef = useRef({ labels, defaults, order });
  latestRef.current = { labels, defaults, order };

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, status: 'loading' }));
    const res = await fetchNavSettings();
    if (res.ok && res.data) {
      onRemoteRef.current?.(res.data.value);
      setState({ status: 'ready', message: '', at: res.data.updatedAt });
    } else if (res.ok) {
      setState({ status: 'empty', message: '', at: null });
    } else {
      setState({ status: res.status === 'not-ready' ? 'not-ready' : 'error', message: res.message, at: null });
    }
    setLoaded(true);
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // 바뀐 뒤 잠깐 모았다가 저장. 공유 설정을 읽기 전에는 저장하지 않는다(읽은 값을 덮어쓰지 않도록).
  useEffect(() => {
    if (!enabled || !loaded || changeTick === 0) return undefined;
    const timer = setTimeout(async () => {
      const { labels: l, defaults: d, order: o } = latestRef.current;
      setState((s) => ({ ...s, status: 'saving' }));
      const res = await saveNavSettings({ order: o, labels: diffNavLabels(l, d) });
      if (res.ok) setState({ status: 'saved', message: '', at: res.data?.updatedAt || new Date().toISOString() });
      else setState({ status: res.status === 'not-ready' ? 'not-ready' : 'error', message: res.message, at: null });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, loaded, changeTick]);

  const markChanged = useCallback(() => setChangeTick((n) => n + 1), []);

  return { ...state, markChanged };
}
