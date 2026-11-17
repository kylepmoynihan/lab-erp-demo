"use client";
import Link from "next/link";
import Shell from "@/components/Shell";
import GoalHeader from "@/components/GoalHeader";
import { detectAlerts, stats } from "@/lib/analytics";
import { STATIONS } from "@/lib/domain";
import { useLab } from "@/lib/store";
import { rangeBounds } from "@/lib/time";

function Overview() {
  const { data, addressed } = useLab();
  const { start, end } = rangeBounds("last7", data.now);
  const s = stats(data, start, end);
  const open = detectAlerts(data).filter((a) => !a.resolvedByScanAt && !addressed[a.id]);
  return (
    <>
      <h1>Lab overview</h1>
      <p className="sub">Last 7 business days. Every number here comes from workers scanning a QR sticker at their station.</p>
      <div className="banner">
        Demo on fictional sample data. Try it: open a station&apos;s scan page as a worker, clock in to a task on an order flagged on the{" "}
        <Link href="/admin/alerts/">Alerts</Link> page, and watch the alert resolve itself.
      </div>
      <GoalHeader data={data} start={start} end={end} s={s} />
      <div className="grid g4 mt">
        <div className="card tile"><div className="label">Clocked in now</div><div className="value">{s.tiles.clockedIn}</div></div>
        <div className="card tile"><div className="label">Open alerts</div><div className="value">{open.length}</div><div className="note"><Link href="/admin/alerts/">Review alerts</Link></div></div>
        <div className="card tile"><div className="label">Tasks completed</div><div className="value">{s.tiles.completed}</div></div>
        <div className="card tile"><div className="label">Ounces processed</div><div className="value">{Math.round(s.tiles.ozProcessed).toLocaleString()}</div></div>
      </div>
      <div className="card mt">
        <h2>Worker scan pages</h2>
        <p className="muted">What a worker sees after scanning the sticker at a station. Spanish first, with an English switch.</p>
        <div className="row">
          {STATIONS.map((st) => (
            <Link key={st.code} href={`/s/${st.code}/`}><button>{st.es}</button></Link>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Overview /></Shell>;
}
