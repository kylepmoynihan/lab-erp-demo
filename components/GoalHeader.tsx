"use client";
import { useState } from "react";
import { compliance, stats, type Data } from "@/lib/analytics";
import { GOALS } from "@/lib/domain";

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "—");
const cls = (x: number, goal: number) => (!Number.isFinite(x) ? "" : x >= goal ? "ok" : x >= goal - 0.05 ? "warn" : "bad");

export default function GoalHeader({ data, start, end, s }: { data: Data; start: number; end: number; s: ReturnType<typeof stats> }) {
  const [mode, setMode] = useState<"active" | "completed">("active");
  const c = compliance(data, start, end, mode);
  return (
    <div className="grid g3">
      <div className="card tile">
        <div className="row">
          <div className="label">Tracking compliance</div>
          <span className="spacer" />
          <div className="seg">
            <button className={mode === "active" ? "on" : ""} onClick={() => setMode("active")}>Active</button>
            <button className={mode === "completed" ? "on" : ""} onClick={() => setMode("completed")}>Completed</button>
          </div>
        </div>
        <div className="value">{pct(c.rate)}</div>
        <div className="note">
          <span className={`goal ${cls(c.rate, GOALS.compliance)}`}>Goal {GOALS.compliance * 100}%</span> {c.clean} of {c.judged} orders with no missed checkpoint
        </div>
        <details className="mt">
          <summary>Basis</summary>
          <p className="muted">
            Orders received in the range. Each order must have a scan for every checkpoint it has passed. Active judges every order on the
            checkpoints it has crossed so far; an order with nothing due yet counts as compliant. Completed only judges orders that have
            shipped.
          </p>
        </details>
      </div>
      <div className="card tile">
        <div className="label">Duration time-to-goal</div>
        <div className="value">{pct(s.onPace.rate)}</div>
        <div className="note">
          <span className={`goal ${cls(s.onPace.rate, GOALS.onPace)}`}>Goal {GOALS.onPace * 100}%</span> {s.onPace.onPace} of {s.onPace.judged} timed tasks on pace
        </div>
        <details className="mt">
          <summary>Basis</summary>
          <p className="muted">
            A task is on pace when it is no slower than its benchmark plus {GOALS.band * 100}%. The benchmark is the median pace for that task
            over the 28 days before the end of the range (dryer tasks are split by dryer size). Working faster is never a miss. Tasks need 3
            benchmark entries to be judged.
          </p>
        </details>
      </div>
      <div className="card tile">
        <div className="label">Left open</div>
        <div className="value">{s.leftOpen.range}</div>
        <div className="note">
          This week {s.leftOpen.thisWeek} · last week {s.leftOpen.lastWeek}
        </div>
        <details className="mt">
          <summary>Basis</summary>
          <p className="muted">
            Entries nobody clocked out of, closed by the 6 PM sweep. They count as done but carry no duration, so they never distort pace.
          </p>
        </details>
      </div>
    </div>
  );
}
