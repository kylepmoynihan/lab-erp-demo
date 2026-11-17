"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import GoalHeader from "@/components/GoalHeader";
import RangePicker from "@/components/RangePicker";
import { checkpointsFor, groupLabel, indexByOrder, stats } from "@/lib/analytics";
import { CHECKPOINTS, statusAt, statusLabel } from "@/lib/domain";
import { useLab } from "@/lib/store";
import { fmtDate, median, rangeBounds, type RangeKey } from "@/lib/time";

function Stats() {
  const { data } = useLab();
  const [range, setRange] = useState<RangeKey>("last7");
  const { start, end } = rangeBounds(range, data.now);
  const s = stats(data, start, end);
  const [fastGroup, setFastGroup] = useState<string>("cut/B3");
  const byOrder = indexByOrder(data.entries);
  const orders = data.orders.filter((o) => o.statusAt.RECEIVED! >= start && o.statusAt.RECEIVED! < end).reverse();

  const fastest = data.workers
    .map((w) => {
      const xs = s.perWorker.get(w.id)?.get(fastGroup) ?? [];
      return { w, n: xs.length, med: median(xs) };
    })
    .filter((r) => r.n >= 3)
    .sort((a, b) => a.med - b.med);
  const fastIsJob = fastGroup.startsWith("dry/A7");

  return (
    <>
      <div className="row">
        <div>
          <h1>Stats</h1>
          <p className="sub">Medians, never averages. Boundaries are midnight Arizona time.</p>
        </div>
        <span className="spacer" />
        <RangePicker value={range} onChange={setRange} />
      </div>
      <GoalHeader data={data} start={start} end={end} s={s} />

      <div className="grid g4 mt">
        <div className="card tile"><div className="label">Tasks completed</div><div className="value">{s.tiles.completed}</div></div>
        <div className="card tile"><div className="label">Net hours worked</div><div className="value">{s.tiles.netHours.toFixed(1)}</div><div className="note">Net of pauses</div></div>
        <div className="card tile"><div className="label">Ounces processed</div><div className="value">{Math.round(s.tiles.ozProcessed).toLocaleString()}</div></div>
        <div className="card tile"><div className="label">Clocked in now</div><div className="value">{s.tiles.clockedIn}</div></div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <h2>Ounces per hour, slowest first</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Task</th><th>Entries</th><th>Oz / hr</th></tr></thead>
              <tbody>
                {s.weighed.map((g) => (
                  <tr key={g.group}><td>{g.label}</td><td>{g.entries}</td><td>{g.ozPerHour!.toFixed(0)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">Receiving is a team batch: the day&apos;s total man-minutes over the day&apos;s combined weight.</p>
          <h2 className="mt">Cleaning, minutes per job</h2>
          <table>
            <thead><tr><th>Task</th><th>Jobs</th><th>Median min</th></tr></thead>
            <tbody>
              {s.cleaning.map((g) => (
                <tr key={g.group}><td>{g.label}</td><td>{g.entries}</td><td>{g.medianPace.toFixed(0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>Fastest workers</h2>
            <span className="spacer" />
            <select value={fastGroup} onChange={(e) => setFastGroup(e.target.value)}>
              {s.groupKeys.map((g) => <option key={g} value={g}>{groupLabel(g)}</option>)}
            </select>
          </div>
          <table className="mt">
            <thead><tr><th>#</th><th>Worker</th><th>Entries</th><th>{fastIsJob ? "Median min / job" : "Oz / hr"}</th></tr></thead>
            <tbody>
              {fastest.map((r, i) => (
                <tr key={r.w.id}><td>{i + 1}</td><td>{r.w.name}</td><td>{r.n}</td><td>{fastIsJob ? r.med.toFixed(0) : (60 / r.med).toFixed(0)}</td></tr>
              ))}
              {!fastest.length && <tr><td colSpan={4} className="muted">Nobody has 3 entries on this task in the range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt">
        <h2>Benchmarks</h2>
        <p className="muted">Each worker&apos;s median pace divided by the task median. 1.20 or slower is yellow, 1.40 or slower is red (below benchmark). 3 entries minimum.</p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Worker</th>{s.groupKeys.map((g) => <th key={g}>{groupLabel(g)}</th>)}</tr>
            </thead>
            <tbody>
              {s.workerRows.map(({ worker, cells }) => (
                <tr key={worker.id}>
                  <td>{worker.name}</td>
                  {s.groupKeys.map((g) => {
                    const c = cells.get(g);
                    if (!c) return <td key={g} className="muted">·</td>;
                    const k = c.ratio >= 1.4 ? "bad" : c.ratio >= 1.2 ? "warn" : "";
                    return <td key={g}><span className={`goal ${k}`}>{c.ratio.toFixed(2)}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt">
        <h2>Tracking compliance by order</h2>
        <p className="muted">
          One square per checkpoint: <span className="chip">{CHECKPOINTS.map((c) => c.code).join(" · ")}</span>{" "}
          Green tracked, red missed, gray not due yet.
        </p>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Order</th><th>Received</th><th>Status</th><th>Checkpoints</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{fmtDate(o.statusAt.RECEIVED!)}</td>
                  <td>{statusLabel(statusAt(o, data.now)!)}</td>
                  <td>
                    <div className="strip">
                      {checkpointsFor(o, byOrder, data.now).map((c) => (
                        <span key={c.task.key} className={`s-${c.state === "n/a" ? "na" : c.state}`} title={`${c.task.code} ${c.task.en}: ${c.state}`} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Stats /></Shell>;
}
