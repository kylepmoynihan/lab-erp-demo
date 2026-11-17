"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import { groupOf, netMinutes, paceByEntry } from "@/lib/analytics";
import { STATIONS, TASKS, taskByKey } from "@/lib/domain";
import { useLab } from "@/lib/store";
import { fmtDateTime, median } from "@/lib/time";

function Log() {
  const { data } = useLab();
  const [station, setStation] = useState("all");
  const [page, setPage] = useState(0);
  const pace = paceByEntry(data);
  // Typical duration per task, for the "long" badge and the runaway panel.
  const durations = new Map<string, number[]>();
  for (const e of data.entries) {
    const m = netMinutes(e);
    if (m !== null) (durations.get(e.task) ?? durations.set(e.task, []).get(e.task)!).push(m);
  }
  const typical = new Map([...durations].map(([k, xs]) => [k, median(xs)]));
  const name = (id: string) => data.workers.find((w) => w.id === id)?.name ?? id;
  const runaway = data.entries
    .filter((e) => e.end === null)
    .map((e) => ({ e, open: (data.now - e.start) / 60000, typ: typical.get(e.task) ?? NaN }))
    .filter((r) => (Number.isFinite(r.typ) ? r.open > 2 * r.typ : r.open > 480));
  const rows = [...data.entries]
    .filter((e) => station === "all" || taskByKey(e.task).station === station)
    .sort((a, b) => b.start - a.start);
  const pageRows = rows.slice(page * 50, page * 50 + 50);

  return (
    <>
      <h1>Clocking log</h1>
      <p className="sub">Every scan, newest first. Badges flag what a manager should look at.</p>
      {runaway.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2>Runaway clocks</h2>
          <ul>
            {runaway.map(({ e, open, typ }) => (
              <li key={e.id}>
                <span className={`goal ${open > 4 * typ ? "bad" : "warn"}`}>{open > 4 * typ ? "critical" : "watch"}</span> {name(e.workerId)} on{" "}
                {taskByKey(e.task).code} for {Math.round(open)} min (typical {Math.round(typ)})
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="row">
        <select value={station} onChange={(e) => { setStation(e.target.value); setPage(0); }}>
          <option value="all">All stations</option>
          {STATIONS.map((s) => <option key={s.code} value={s.code}>{s.en}</option>)}
        </select>
        <span className="spacer" />
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
        <span className="muted">{page * 50 + 1}–{Math.min(rows.length, page * 50 + 50)} of {rows.length}</span>
        <button disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(page + 1)}>Older</button>
      </div>
      <div className="card mt tablewrap">
        <table>
          <thead><tr><th>Started</th><th>Worker</th><th>Task</th><th>Orders</th><th>Net min</th><th>Pace</th><th></th></tr></thead>
          <tbody>
            {pageRows.map((e) => {
              const t = taskByKey(e.task);
              const m = netMinutes(e);
              const p = pace.get(e.id);
              const long = m !== null && m > 2 * (typical.get(e.task) ?? Infinity);
              return (
                <tr key={e.id}>
                  <td>{fmtDateTime(e.start)}</td>
                  <td>{name(e.workerId)}</td>
                  <td>{t.code} {t.en}{e.machine ? ` · ${e.machine}` : ""}</td>
                  <td>{e.orders.length > 3 ? `${e.orders.length} orders` : e.orders.join(", ")}</td>
                  <td>{e.end === null ? "open" : m === null ? "—" : Math.round(m)}</td>
                  <td>{p === undefined ? "" : t.measure === "job" ? `${Math.round(p)} min/job` : `${Math.round(60 / p)} oz/hr`}</td>
                  <td>
                    {e.end === null && <span className="goal ok">clocked in</span>}{" "}
                    {e.autoClosed && <span className="goal warn">auto-closed</span>}{" "}
                    {long && <span className="goal warn">over 2× typical</span>}{" "}
                    {e.partners?.length ? <span className="chip">team</span> : null}{" "}
                    {e.source === "demo" && <span className="chip">your scan</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Log /></Shell>;
}
