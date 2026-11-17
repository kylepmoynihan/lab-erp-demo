"use client";
// What a worker sees after scanning a station's sticker. Built for a shared
// phone or a cheap Android on the wall: Spanish first, big buttons, one screen.
import Link from "next/link";
import { useMemo, useState } from "react";
import { detectAlerts } from "@/lib/analytics";
import { DRYERS, STATIONS, TASKS, statusAt, taskByKey, type Entry, type Worker } from "@/lib/domain";
import { useLab } from "@/lib/store";
import { MIN, fmtTime } from "@/lib/time";

const T = {
  es: {
    who: "¿Quién eres?",
    start: "Iniciar tarea", task: "Tarea", order: "Orden",
    machine: "Máquina", choose: "Elige…", go: "Iniciar", stamp: "Registrar", pause: "Pausar", resume: "Reanudar", done: "Terminar",
    since: "desde", paused: "en pausa", switchUser: "Cambiar de usuario", missing: "falta escaneo", saved: "¡Listo! Registrado.",
    notAllowed: "No estás asignado a esta estación.", back: "Volver al panel",
    finished: "Tarea terminada", min: "min", ok: "Listo",
    forgot: "Todavía tenías una tarea abierta en", told: "La cerramos y avisamos a operaciones.",
  },
  en: {
    who: "Who are you?",
    start: "Start a task", task: "Task", order: "Order",
    machine: "Dryer", choose: "Choose…", go: "Start", stamp: "Record", pause: "Pause", resume: "Resume", done: "Finish",
    since: "since", paused: "paused", switchUser: "Switch user", missing: "scan missing", saved: "Done! Recorded.",
    notAllowed: "You are not assigned to this station.", back: "Back to dashboard",
    finished: "Task finished", min: "min", ok: "Done",
    forgot: "You still had a task open at", told: "We closed it and let operations know.",
  },
};

export default function ScanPage({ code }: { code: string }) {
  const { data, addEntry, updateEntry, addressed } = useLab();
  const [lang, setLang] = useState<"es" | "en">("es");
  const [worker, setWorker] = useState<Worker | null>(null);
  const [taskKey, setTaskKey] = useState("");
  const [orderId, setOrderId] = useState("");
  const [machine, setMachine] = useState("");
  const [flash, setFlash] = useState("");
  // Result of the scan: a task closed here (re-scan = clock out), or a task left open elsewhere.
  const [closedHere, setClosedHere] = useState<Entry[]>([]);
  const [closedElsewhere, setClosedElsewhere] = useState<Entry[]>([]);
  const t = T[lang];
  const station = STATIONS.find((s) => s.code === code);
  const tasks = TASKS.filter((x) => x.station === code);
  const name = (x: { es: string; en: string }) => (lang === "es" ? x.es : x.en);

  const missing = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      detectAlerts(data)
        .filter((a) => a.kind === "missed" && !a.resolvedByScanAt && !addressed[a.id])
        .map((a) => `${a.order.id}|${a.task.key}`),
    );
  }, [data, addressed]);

  if (!station) return <div className="shell"><p>Station not found.</p></div>;
  if (!data) return <div className="shell"><p className="muted">…</p></div>;

  const inHouse = data.orders
    .filter((o) => statusAt(o, data.now) !== "SHIPPED")
    .sort((a, b) => b.statusAt.RECEIVED! - a.statusAt.RECEIVED!);
  // An order is flagged when it is missing a scan for any task at this station.
  const flagged = (orderKey: string) => tasks.some((x) => missing.has(`${orderKey}|${x.key}`));
  const orderOptions = [...inHouse].sort((a, b) => Number(flagged(b.id)) - Number(flagged(a.id)));
  // A station with one task needs no second choice.
  const effectiveTaskKey = tasks.length === 1 ? tasks[0].key : taskKey;
  const task = effectiveTaskKey ? taskByKey(effectiveTaskKey) : null;
  const allowed = data.workers.filter((w) => w.active && (!w.stations || w.stations.includes(code)));

  const ping = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };
  const start = () => {
    if (!worker || !task || !orderId || (task.machine && !machine)) return;
    const now = Date.now();
    const o = data.orders.find((x) => x.id === orderId);
    addEntry({
      workerId: worker.id,
      task: task.key,
      start: now,
      end: task.measure === "stamp" ? now : null,
      pausedMin: 0,
      orders: [orderId],
      machine: machine || undefined,
      lot: task.key === "dry/B6" ? o?.lot : undefined,
    });
    reset();
    ping(t.saved);
  };
  /** Picking your name is the second half of a scan. An open task here is finished by the re-scan;
   *  an open task at another station is closed and flagged for operations. */
  const selectWorker = (w: Worker) => {
    const now = Date.now();
    const mine = data.entries.filter((e) => e.workerId === w.id && e.end === null);
    const here = mine.filter((e) => taskByKey(e.task).station === code);
    const elsewhere = mine.filter((e) => taskByKey(e.task).station !== code);
    const close = (e: Entry, patch: Partial<Entry> = {}) => {
      const extra = e.pausedAt ? (now - e.pausedAt) / MIN : 0;
      updateEntry(e.id, { end: now, pausedMin: e.pausedMin + extra, pausedAt: undefined, ...patch });
    };
    here.forEach((e) => close(e));
    elsewhere.forEach((e) => close(e, { forgotClockOut: code }));
    setClosedHere(here.map((e) => ({ ...e, end: now })));
    setClosedElsewhere(elsewhere);
    setWorker(w);
  };
  const reset = () => {
    setWorker(null);
    setClosedHere([]);
    setClosedElsewhere([]);
    setOrderId("");
    setTaskKey("");
    setMachine("");
  };

  const big = { fontSize: 18, padding: "14px 16px", width: "100%" } as const;
  return (
    <div className="shell" style={{ maxWidth: 520, paddingTop: 16 }}>
      <div className="row">
        <Link href="/" className="muted">← {t.back}</Link>
        <span className="spacer" />
        <div className="seg">
          <button className={lang === "es" ? "on" : ""} onClick={() => setLang("es")}>ES</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </div>
      <div style={{ textAlign: "center", margin: "18px 0" }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{name(station)}</div>
        <div className="muted">{lang === "es" ? station.en : station.es} · <span style={{ color: "var(--coral)", fontWeight: 700 }}>{code.toUpperCase()}</span></div>
      </div>
      {flash && <div className="goal ok" style={{ display: "block", textAlign: "center", padding: 10, fontSize: 16, marginBottom: 12 }}>{flash}</div>}

      {!worker && (
        <div className="card">
          <h2>{t.who}</h2>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {allowed.map((w) => <button key={w.id} style={big} onClick={() => selectWorker(w)}>{w.name}</button>)}
          </div>
        </div>
      )}

      {worker && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <strong style={{ fontSize: 16 }}>{worker.name}</strong>
            <span className="spacer" />
            <button onClick={reset}>{t.switchUser}</button>
          </div>
          {closedElsewhere.map((e) => (
            <div key={e.id} className="card" style={{ borderColor: "var(--warn)", marginBottom: 12 }}>
              <strong>⚠ {t.forgot} {name(STATIONS.find((x) => x.code === taskByKey(e.task).station)!)}.</strong>
              <div className="muted">{taskByKey(e.task).code} {name(taskByKey(e.task))} · {e.orders.join(", ")} · {t.told}</div>
            </div>
          ))}
          {closedHere.length > 0 ? (
            <div className="card" style={{ textAlign: "center" }}>
              <div className="goal ok" style={{ fontSize: 18, padding: "8px 14px" }}>✓ {t.finished}</div>
              {closedHere.map((e) => (
                <p key={e.id} style={{ fontSize: 16 }}>
                  <strong>{taskByKey(e.task).code} {name(taskByKey(e.task))}</strong> · {e.orders.join(", ")}<br />
                  <span className="muted">{fmtTime(e.start)} · {Math.max(1, Math.round((e.end! - e.start) / MIN - e.pausedMin))} {t.min}</span>
                </p>
              ))}
              <button className="primary" style={big} onClick={reset}>{t.ok}</button>
            </div>
          ) : (
          <div className="card">
            <h2>{t.start}</h2>
            <label className="muted">{t.order}</label>
            <select style={big} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">{t.choose}</option>
              {orderOptions.slice(0, 40).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} · {o.oz} oz{flagged(o.id) ? ` · ⚠ ${t.missing}` : ""}
                </option>
              ))}
            </select>
            {orderId && tasks.length > 1 && (
              <>
                <label className="muted" style={{ display: "block", marginTop: 10 }}>{t.task}</label>
                <select style={big} value={taskKey} onChange={(e) => setTaskKey(e.target.value)}>
                  <option value="">{t.choose}</option>
                  {tasks.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.code} {name(x)}{missing.has(`${orderId}|${x.key}`) ? ` · ⚠ ${t.missing}` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
            {task && orderId && (
              <>
                {task.machine && (
                  <>
                    <label className="muted" style={{ display: "block", marginTop: 10 }}>{t.machine}</label>
                    <select style={big} value={machine} onChange={(e) => setMachine(e.target.value)}>
                      <option value="">{t.choose}</option>
                      {DRYERS.map((d) => <option key={d.id} value={d.id}>{d.id} ({d.size})</option>)}
                    </select>
                  </>
                )}
                <button className="primary" style={{ ...big, marginTop: 14 }} disabled={!orderId || !task || (task.machine && !machine)} onClick={start}>
                  {task.measure === "stamp" ? t.stamp : t.go}
                </button>
              </>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}
