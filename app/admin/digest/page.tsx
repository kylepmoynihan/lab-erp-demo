"use client";
import Shell from "@/components/Shell";
import { detectAlerts, digestSlots } from "@/lib/analytics";
import { useLab } from "@/lib/store";
import { fmtDateTime, fmtDayLong, fmtTime, phxDay } from "@/lib/time";

function Digest() {
  const { data, addressed } = useLab();
  const slots = digestSlots(data.now);
  const slot = slots[slots.length - 1];
  const prev = slots[slots.length - 2] ?? 0;
  if (!slot) return <p className="muted">No digest has gone out yet.</p>;
  const all = detectAlerts(data);
  const openAt = (a: (typeof all)[number]) =>
    a.detectedAt <= slot && !(a.resolvedByScanAt && a.resolvedByScanAt <= slot) && !(addressed[a.id] && addressed[a.id] <= slot);
  const fresh = all.filter((a) => openAt(a) && a.detectedAt > prev).sort((a, b) => b.detectedAt - a.detectedAt);
  const still = all.filter((a) => openAt(a) && a.detectedAt <= prev).sort((a, b) => b.detectedAt - a.detectedAt);
  const resolvedToday = all.filter((a) => a.resolvedByScanAt && a.resolvedByScanAt <= slot && phxDay(a.resolvedByScanAt) === phxDay(slot)).length;
  const line = (a: (typeof all)[number]) => (
    <li key={a.id}>
      <strong>{a.order.id}</strong> · {a.task.code} {a.task.en} · <span className="muted">{a.rule}, {fmtDateTime(a.detectedAt)}</span>
    </li>
  );

  return (
    <>
      <h1>Digest</h1>
      <p className="sub">
        Sent at 12:30 PM and 4:30 PM Arizona time on business days to the lab manager and leads (never floor staff). It replaced one email per
        miss, which people had learned to ignore. Below is the most recent one.
      </p>
      <div className="card" style={{ maxWidth: 720 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Subject: Lab tracking · {fresh.length} new, {fresh.length + still.length} open · {fmtTime(slot)} {fmtDayLong(slot)}
        </p>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)" }} />
        {fresh.length + still.length === 0 ? (
          <p><strong>All clear.</strong> No open tracking misses.</p>
        ) : (
          <>
            <p>
              <strong>{fresh.length}</strong> new since the last report · <strong>{fresh.length + still.length}</strong> still open ·{" "}
              <strong>{resolvedToday}</strong> resolved by scan today
            </p>
            <h2>New since the last report</h2>
            <ul>{fresh.slice(0, 60).map(line)}</ul>
            {!fresh.length && <p className="muted">None.</p>}
            <h2>Reported before, still open</h2>
            <ul>{still.slice(0, 20).map(line)}</ul>
            {still.length > 20 && <p className="muted">…and {still.length - 20} more on the Alerts page.</p>}
            {!still.length && <p className="muted">None.</p>}
          </>
        )}
        <h2>What to do</h2>
        <p className="muted">
          If the batch is still in the building, have the person who did the step scan it now; the alert clears itself. If it has shipped, mark it
          addressed on the Alerts page after you talk to the team.
        </p>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Digest /></Shell>;
}
