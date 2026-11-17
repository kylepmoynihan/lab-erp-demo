"use client";
// Demo store: the seeded dataset plus anything a visitor scans in the browser.
// In production this is Supabase (see supabase/schema.sql); here it lives in
// localStorage so the demo needs no backend and every visitor starts clean.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Entry } from "./domain";
import { generate, type Dataset } from "./seed";
import type { Data } from "./analytics";

import { detectAlerts } from "./analytics";
import { phxDay } from "./time";

// The sample data is regenerated for each Arizona day, so a visitor's scans and
// "addressed" marks are kept per day and start fresh the next morning.
const STATE_KEY = "lab-demo-state-v2";
type Saved = { day: number; entries: Entry[]; addressed: Record<string, number> };

/** The lab manager has already worked through misses older than a week. */
function seedAddressed(d: Dataset) {
  const out: Record<string, number> = {};
  const cutoff = d.now - 7 * 86_400_000;
  for (const a of detectAlerts(d)) if (!a.resolvedByScanAt && a.detectedAt < cutoff) out[a.id] = a.detectedAt + 86_400_000;
  return out;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the demo still works for this page view */
  }
}

function persist(patch: Partial<Saved>) {
  const cur = load<Saved>(STATE_KEY, { day: phxDay(Date.now()), entries: [], addressed: {} });
  save(STATE_KEY, { ...cur, ...patch });
}

type Ctx = {
  data: Data | null;
  addEntry: (e: Omit<Entry, "id" | "source">) => void;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  addressed: Record<string, number>;
  setAddressed: (ids: string[], on: boolean) => void;
  reset: () => void;
};
const LabContext = createContext<Ctx | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState<Dataset | null>(null);
  const [local, setLocal] = useState<Entry[]>([]);
  const [addressed, setAddr] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = Date.now();
    const ds = generate(t);
    setSeed(ds);
    setNow(t);
    const saved = load<Saved | null>(STATE_KEY, null);
    if (saved && saved.day === phxDay(t)) {
      setLocal(saved.entries);
      setAddr(saved.addressed);
    } else {
      const fresh = { day: phxDay(t), entries: [], addressed: seedAddressed(ds) };
      save(STATE_KEY, fresh);
      setAddr(fresh.addressed);
    }
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo<Data | null>(() => {
    if (!seed) return null;
    const mine = local.filter((e) => e.start <= now);
    return { workers: seed.workers, orders: seed.orders, entries: [...seed.entries, ...mine], now };
  }, [seed, local, now]);

  const addEntry = useCallback((e: Omit<Entry, "id" | "source">) => {
    setNow(Date.now());
    setLocal((cur) => {
      const next = [...cur, { ...e, id: `d${Date.now()}`, source: "demo" as const }];
      persist({ entries: next });
      return next;
    });
  }, []);
  const updateEntry = useCallback((id: string, patch: Partial<Entry>) => {
    setNow(Date.now());
    setLocal((cur) => {
      const next = cur.map((e) => (e.id === id ? { ...e, ...patch } : e));
      persist({ entries: next });
      return next;
    });
    // Seeded entries can be clocked out too (the planted forgotten clock-out).
    setSeed((s) => (s ? { ...s, entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : s));
  }, []);
  const setAddressed = useCallback((ids: string[], on: boolean) => {
    setAddr((cur) => {
      const next = { ...cur };
      for (const id of ids) on ? (next[id] = Date.now()) : delete next[id];
      persist({ addressed: next });
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    const t = Date.now();
    const ds = generate(t);
    const fresh = { day: phxDay(t), entries: [], addressed: seedAddressed(ds) };
    save(STATE_KEY, fresh);
    setLocal([]);
    setAddr(fresh.addressed);
    setSeed(ds);
    setNow(t);
  }, []);

  return <LabContext.Provider value={{ data, addEntry, updateEntry, addressed, setAddressed, reset }}>{children}</LabContext.Provider>;
}

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab outside LabProvider");
  return ctx;
}

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
