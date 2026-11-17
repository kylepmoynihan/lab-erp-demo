"use client";
import { Fragment, useState } from "react";
import Shell from "@/components/Shell";
import { detectAlerts, fixabilitySort, type Alert } from "@/lib/analytics";
import { statusAt, statusLabel, type StatusCode } from "@/lib/domain";
import { useLab } from "@/lib/store";
import { fmtDateTime, fmtTime, phxDay } from "@/lib/time";

function Alerts() {
  const { data, addressed, setAddressed } = useLab();
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const all = detectAlerts(data);
  const isOpen = (a: Alert) => !a.resolvedByScanAt && !addressed[a.id];
  const today = phxDay(data.now);
  const openNow = all.filter(isOpen);
  const newToday = all.filter((a) => phxDay(a.detectedAt) === today);
  const resolvedToday = all.filter(
    (a) => (a.resolvedByScanAt && phxDay(a.resolvedByScanAt) === today) || (addressed[a.id] && phxDay(addressed[a.id]) === today),
  );
  const rows = fixabilitySort(all, isOpen, data.now).filter((a) => (filter === "all" ? true : filter === "open" ? isOpen(a) : !isOpen(a)));

  return (
    <>
      <h1>Alerts</h1>
      <p className="sub">
        Missed scans, caught from production evidence. When weights are keyed at a station but nobody scanned in there, the miss shows up
        within 15 minutes, while the batch is usually still in the building.
      </p>
      <div className="grid g3">
        <div className="card tile"><div className="label">Open now</div><div className="value">{openNow.length}</div></div>
        <div className="card tile"><div className="label">New today</div><div className="value">{newToday.length}</div></div>
        <div className="card tile"><div className="label">Resolved today</div><div className="value">{resolvedToday.length}</div></div>
      </div>
      <div className="row mt">
        <div className="seg">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <span className="spacer" />
        <button disabled={!openNow.length} onClick={() => setAddressed(openNow.map((a) => a.id), true)}>Resolve all ({openNow.length})</button>
      </div>
      <div className="card mt tablewrap">
        <table>
          <thead>
            <tr><th>Order</th><th>Missed task</th><th>Why</th><th>Status now</th><th>Detected</th><th>Resolution</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const now = statusAt(a.order, data.now) as StatusCode;
              return (
                <Fragment key={a.id}>
                  <tr onClick={() => setExpanded(expanded === a.id ? null : a.id)} style={{ cursor: "pointer" }}>
                    <td>{expanded === a.id ? "▾" : "▸"} {a.order.id}</td>
                    <td>
                      {a.task.code} {a.task.en}
                      {a.kind === "left-open" && <> <span className="chip">left open</span></>}
                      {a.kind === "forgot-clockout" && <> <span className="chip">forgot to clock out</span></>}
                    </td>
                    <td className="muted">{a.rule}</td>
                    <td title={`At detection: ${statusLabel(a.statusAtDetect as StatusCode)}`}>
                      {statusLabel(now)} {now !== "SHIPPED" && <span className="chip">in-house</span>}
                    </td>
                    <td>{fmtDateTime(a.detectedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {a.resolvedByScanAt ? (
                        <span className="goal ok">Resolved by scan</span>
                      ) : (
                        <label className="row" style={{ gap: 6 }}>
                          <input type="checkbox" checked={!!addressed[a.id]} onChange={(e) => setAddressed([a.id], e.target.checked)} />
                          <span className={addressed[a.id] ? "goal warn" : "muted"}>{addressed[a.id] ? "Addressed" : "Mark addressed"}</span>
                        </label>
                      )}
                    </td>
                  </tr>
                  {expanded === a.id && (
                    <tr>
                      <td colSpan={6}>
                        <strong>Who was there.</strong>{" "}
                        <span className="muted">People clocked in at this station on the day the work happened. A starting point for asking, not blame.</span>
                        <ul>
                          {a.roster.map((r) => (
                            <li key={r.worker.id}>{r.worker.name}: {fmtTime(r.first)} to {fmtTime(r.last)}</li>
                          ))}
                          {!a.roster.length && <li className="muted">Nobody was clocked in at this station that day.</li>}
                        </ul>
                        {addressed[a.id] && <p className="muted">Manually addressed by the lab manager. Manual resolution never changes the compliance numbers.</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Alerts /></Shell>;
}
