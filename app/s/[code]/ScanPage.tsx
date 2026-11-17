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
    who: "¿Quién eres?", pin: "PIN", enter: "Entrar", wrongPin: "PIN incorrecto", demoPin: "Demo: el PIN es",
    open: "Tus tareas abiertas", none: "No tienes tareas abiertas.", start: "Iniciar tarea", task: "Tarea", order: "Número de orden",
    machine: "Máquina", choose: "Elige…", go: "Iniciar", stamp: "Registrar", pause: "Pausar", resume: "Reanudar", done: "Terminar",
    since: "desde", paused: "en pausa", switchUser: "Cambiar de usuario", missing: "falta escaneo", saved: "¡Listo! Registrado.",
    notAllowed: "No estás asignado a esta estación.", back: "Volver al panel",
  },
  en: {
    who: "Who are you?", pin: "PIN", enter: "Sign in", wrongPin: "Wrong PIN", demoPin: "Demo: the PIN is",
    open: "Your open tasks", none: "You have no open tasks.", start: "Start a task", task: "Task", order: "Order number",
    machine: "Dryer", choose: "Choose…", go: "Start", stamp: "Record", pause: "Pause", resume: "Resume", done: "Finish",
    since: "since", paused: "paused", switchUser: "Switch user", missing: "scan missing", saved: "Done! Recorded.",
    notAllowed: "You are not assigned to this station.", back: "Back to dashboard",
  },
};

export default function ScanPage({ code }: { code: string }) {
  const { data, addEntry, updateEntry, addressed } = useLab();
  const [lang, setLang] = useState<"es" | "en">("es");
  const [worker, setWorker] = useState<Worker | null>(null);
  const [picked, setPicked] = useState<Worker | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [taskKey, setTaskKey] = useState("");
  const [orderId, setOrderId] = useState("");
  const [machine, setMachine] = useState("");
  const [flash, setFlash] = useState("");
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
  const orderOptions = taskKey
    ? [...inHouse].sort((a, b) => Number(missing.has(`${b.id}|${taskKey}`)) - Number(missing.has(`${a.id}|${taskKey}`)))
    : inHouse;
  const task = taskKey ? taskByKey(taskKey) : null;
  const open = worker ? data.entries.filter((e) => e.workerId === worker.id && e.end === null) : [];
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
    setTaskKey("");
    setOrderId("");
    setMachine("");
    ping(t.saved);
  };
  const finish = (e: Entry) => {
    const now = Date.now();
    const extra = e.pausedAt ? (now - e.pausedAt) / MIN : 0;
    updateEntry(e.id, { end: now, pausedMin: e.pausedMin + extra, pausedAt: undefined });
    ping(t.saved);
  };
  const togglePause = (e: Entry) => {
    const now = Date.now();
    if (e.pausedAt) updateEntry(e.id, { pausedMin: e.pausedMin + (now - e.pausedAt) / MIN, pausedAt: undefined });
    else updateEntry(e.id, { pausedAt: now });
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

      {!worker && !picked && (
        <div className="card">
          <h2>{t.who}</h2>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {allowed.map((w) => <button key={w.id} style={big} onClick={() => setPicked(w)}>{w.name}</button>)}
          </div>
        </div>
      )}

      {!worker && picked && (
        <div className="card">
          <h2>{picked.name}</h2>
          <input
            inputMode="numeric" maxLength={4} value={pin} placeholder={t.pin} autoFocus
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinErr(false); }}
            style={{ ...big, textAlign: "center", letterSpacing: ".4em" }}
          />
          {pinErr && <p className="goal bad">{t.wrongPin}</p>}
          <p className="muted">{t.demoPin} {picked.pin}</p>
          <div className="row">
            <button onClick={() => { setPicked(null); setPin(""); }}>←</button>
            <button className="primary" style={{ flex: 1, padding: 12, fontSize: 16 }}
              onClick={() => (pin === picked.pin ? (setWorker(picked), setPin("")) : setPinErr(true))}>{t.enter}</button>
          </div>
        </div>
      )}

      {worker && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <strong style={{ fontSize: 16 }}>{worker.name}</strong>
            <span className="spacer" />
            <button onClick={() => { setWorker(null); setPicked(null); }}>{t.switchUser}</button>
          </div>
          <div className="card">
            <h2>{t.open}</h2>
            {!open.length && <p className="muted">{t.none}</p>}
            {open.map((e) => {
              const x = taskByKey(e.task);
              return (
                <div key={e.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                  <div><strong>{x.code} {name(x)}</strong> · {e.orders.join(", ")}{e.machine ? ` · ${e.machine}` : ""}</div>
                  <div className="muted">{t.since} {fmtTime(e.start)}{e.pausedAt ? ` · ${t.paused}` : ""}</div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button style={{ flex: 1, padding: 12 }} onClick={() => togglePause(e)}>{e.pausedAt ? t.resume : t.pause}</button>
                    <button className="primary" style={{ flex: 1, padding: 12 }} onClick={() => finish(e)}>{t.done}</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card mt">
            <h2>{t.start}</h2>
            <label className="muted">{t.task}</label>
            <select style={big} value={taskKey} onChange={(e) => { setTaskKey(e.target.value); setOrderId(""); }}>
              <option value="">{t.choose}</option>
              {tasks.map((x) => <option key={x.key} value={x.key}>{x.code} {name(x)}</option>)}
            </select>
            {task && (
              <>
                <label className="muted" style={{ display: "block", marginTop: 10 }}>{t.order}</label>
                <select style={big} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                  <option value="">{t.choose}</option>
                  {orderOptions.slice(0, 40).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} · {o.oz} oz{missing.has(`${o.id}|${task.key}`) ? ` · ⚠ ${t.missing}` : ""}
                    </option>
                  ))}
                </select>
                {task.machine && (
                  <>
                    <label className="muted" style={{ display: "block", marginTop: 10 }}>{t.machine}</label>
                    <select style={big} value={machine} onChange={(e) => setMachine(e.target.value)}>
                      <option value="">{t.choose}</option>
                      {DRYERS.map((d) => <option key={d.id} value={d.id}>{d.id} ({d.size})</option>)}
                    </select>
                  </>
                )}
                <button className="primary" style={{ ...big, marginTop: 14 }} disabled={!orderId || (task.machine && !machine)} onClick={start}>
                  {task.measure === "stamp" ? t.stamp : t.go}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
