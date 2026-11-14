import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { Attempt } from './types';
import { MOCKS, getMock } from './data';
import { finalise, finaliseExpired, loadStore, newAttempt, saveStore, type Store } from './lib/storage';
import { isExpired } from './lib/timer';
import Dashboard from './pages/Dashboard';
import PreTest from './pages/PreTest';
import Exam from './pages/Exam';
import Result from './pages/Result';
import Review from './pages/Review';
import Progress from './pages/Progress';

interface Ctx {
  store: Store;
  storageOk: boolean;
  getAttempt: (id: string) => Attempt | undefined;
  activeAttemptFor: (mockId: number) => Attempt | undefined;
  startAttempt: (mockId: number) => Attempt;
  updateAttempt: (id: string, f: (a: Attempt) => Attempt) => void;
  submitAttempt: (id: string, auto: boolean) => void;
  replaceStore: (s: Store) => void;
}
const StoreCtx = createContext<Ctx | null>(null);
export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreCtx missing');
  return c;
};

export function navigate(hash: string) { window.location.hash = hash; }

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const [storageOk, setStorageOk] = useState(true);
  const [store, setStore] = useState<Store>(() => {
    const s = loadStore();
    const { store: fin, changed } = finaliseExpired(s, MOCKS, Date.now());
    if (changed) saveStore(fin);
    return fin;
  });

  const persist = useCallback((s: Store) => { setStorageOk(saveStore(s)); return s; }, []);

  // Keep other tabs in sync, and finalise attempts that expire while the dashboard is open.
  useEffect(() => {
    const onStorage = () => setStore(loadStore());
    window.addEventListener('storage', onStorage);
    const t = window.setInterval(() => {
      setStore((s) => { const r = finaliseExpired(s, MOCKS, Date.now()); return r.changed ? persist(r.store) : s; });
    }, 5000);
    return () => { window.removeEventListener('storage', onStorage); window.clearInterval(t); };
  }, [persist]);

  const updateAttempt = useCallback((id: string, f: (a: Attempt) => Attempt) => {
    setStore((s) => persist({ ...s, attempts: s.attempts.map((a) => (a.id === id && a.submittedAt === null ? f(a) : a)) }));
  }, [persist]);
  const submitAttempt = useCallback((id: string, auto: boolean) => {
    setStore((s) => persist({ ...s, attempts: s.attempts.map((a) => {
      if (a.id !== id) return a;
      const mock = getMock(a.mockId);
      return mock ? finalise(a, mock, Date.now(), auto) : a;
    }) }));
  }, [persist]);

  const ctx = useMemo<Ctx>(() => ({
    store,
    storageOk,
    getAttempt: (id) => store.attempts.find((a) => a.id === id),
    activeAttemptFor: (mockId) => store.attempts.find((a) => a.mockId === mockId && a.submittedAt === null && !isExpired(Date.now(), a.deadline)),
    startAttempt: (mockId) => {
      const existing = store.attempts.find((a) => a.mockId === mockId && a.submittedAt === null && !isExpired(Date.now(), a.deadline));
      if (existing) return existing;
      const a = newAttempt(mockId, store.attempts, Date.now());
      setStore((s) => persist({ ...s, attempts: [...s.attempts, a] }));
      return a;
    },
    updateAttempt,
    submitAttempt,
    replaceStore: (s) => setStore(persist(s)),
  }), [store, storageOk, persist, updateAttempt, submitAttempt]);

  const hash = useHashRoute();
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let page: ReactElement;
  if (parts[0] === 'mock' && parts[1]) page = <PreTest mockId={Number(parts[1])} />;
  else if (parts[0] === 'exam' && parts[1]) page = <Exam attemptId={parts[1]} />;
  else if (parts[0] === 'result' && parts[1]) page = <Result attemptId={parts[1]} />;
  else if (parts[0] === 'review' && parts[1]) page = <Review attemptId={parts[1]} initialQ={parts[2] ? Number(parts[2]) : undefined} />;
  else if (parts[0] === 'progress') page = <Progress />;
  else page = <Dashboard />;

  return <StoreCtx.Provider value={ctx}>{page}</StoreCtx.Provider>;
}
