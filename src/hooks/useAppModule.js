import { useCallback, useEffect, useState } from 'react';

export function getModuleFromUrl() {
  const m = new URLSearchParams(window.location.search).get('module');
  return m === 'journal' ? 'journal' : 'ledger';
}

export function useAppModule() {
  const [module, setModuleState] = useState(getModuleFromUrl);

  useEffect(() => {
    const onPop = () => setModuleState(getModuleFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setModule = useCallback((next) => {
    const url = new URL(window.location.href);
    if (next === 'ledger') url.searchParams.delete('module');
    else url.searchParams.set('module', next);
    window.history.pushState({}, '', url);
    setModuleState(next);
  }, []);

  return { module, setModule };
}
