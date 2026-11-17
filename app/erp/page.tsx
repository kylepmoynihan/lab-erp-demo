"use client";
import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { BUILD_STORY, OBJECTS, ROLES, STAGES, relatedTo, type Obj, type Role } from "@/lib/erp";

function Node({ o, state, credit, onPick }: { o: Obj; state: "sel" | "rel" | "dim" | "plain"; credit: boolean; onPick: () => void }) {
  const role = credit && o.role ? ROLES[o.role] : null;
  return (
    <button
      data-id={o.id}
      onClick={onPick}
      className={`node ${o.kind} ${state}`}
      style={role ? { boxShadow: `inset 4px 0 0 ${role.color}` } : undefined}
      title={o.kind === "automation" ? "Automation" : "Table"}
    >
      {o.kind === "automation" && <span className="auto">auto</span>}
      {o.name}
    </button>
  );
}

function Map() {
  const [sel, setSel] = useState("orders");
  const [credit, setCredit] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ d: string; key: string }[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const cur = OBJECTS.find((o) => o.id === sel)!;
  const related = relatedTo(sel);
  const relSet = new Set(related);
  const name = (id: string) => OBJECTS.find((o) => o.id === id)?.name ?? id;

  const draw = useCallback(() => {
    const w = wrap.current;
    if (!w) return;
    const base = w.getBoundingClientRect();
    const center = (id: string) => {
      const el = w.querySelector<HTMLElement>(`[data-id="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
    };
    const a = center(sel);
    if (!a) return;
    const out: { d: string; key: string }[] = [];
    for (const id of relatedTo(sel)) {
      const b = center(id);
      if (!b) continue;
      const my = (a.y + b.y) / 2;
      const d = Math.abs(a.y - b.y) < 4
        ? `M${a.x},${a.y} Q${(a.x + b.x) / 2},${a.y - 28} ${b.x},${b.y}`
        : `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
      out.push({ d, key: id });
    }
    setLines(out);
    setBox({ w: base.width, h: base.height });
  }, [sel]);

  useLayoutEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [draw, credit]);

  const pick = (id: string) => {
    setSel(id);
    if (typeof window !== "undefined" && window.innerWidth < 900) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <h1>ERP map</h1>
      <p className="sub" style={{ maxWidth: 780 }}>
        The data model of the custom ERP a breast milk freeze-drying lab runs on, following one order from the online store to its
        true shipping cost. Lines show what the selected piece connects to. Click anything to see why it&apos;s built the way it is.
      </p>

      <div className="row" style={{ marginBottom: 12 }}>
        <span className="legend"><span className="node table sw" /> Table</span>
        <span className="legend"><span className="node automation sw" /> Automation</span>
        <span className="spacer" />
        <label className="row" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} />
          Show who built what
        </label>
      </div>
      {credit && (
        <div className="row" style={{ marginBottom: 12, gap: 14 }}>
          {(Object.keys(ROLES) as Role[]).map((r) => (
            <span key={r} className="legend"><span className="sw" style={{ background: ROLES[r].color, width: 4, height: 14, borderRadius: 2 }} /> {ROLES[r].label}</span>
          ))}
          <span className="legend muted">No mark: built by the company&apos;s quality consultant</span>
        </div>
      )}

      <div className="erp">
        <div className="lifecycle" ref={wrap}>
          <svg className="links" width={box.w} height={box.h} aria-hidden>
            {lines.map((l) => <path key={l.key} d={l.d} />)}
          </svg>
          {STAGES.map((s, i) => (
            <div className="stage" key={s.id}>
              <div className="dot">{i + 1}</div>
              <div className="stagehead">
                <div className="stagename">{s.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{s.note}</div>
              </div>
              <div className="nodes">
                {OBJECTS.filter((o) => o.stage === s.id).map((o) => (
                  <Node key={o.id} o={o} credit={credit} onPick={() => pick(o.id)}
                    state={o.id === sel ? "sel" : relSet.has(o.id) ? "rel" : "plain"} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card detail" ref={panel}>
          <div className="muted" style={{ fontSize: 12 }}>
            {cur.kind === "automation" ? "Automation" : "Table"} · {STAGES.find((s) => s.id === cur.stage)!.name}
          </div>
          <h2 style={{ margin: "2px 0 8px", fontSize: 18 }}>{cur.name}</h2>
          {credit && cur.role && (
            <p style={{ margin: "0 0 10px" }}>
              <span className="goal" style={{ background: "var(--chip)", boxShadow: `inset 4px 0 0 ${ROLES[cur.role].color}`, paddingLeft: 12 }}>{ROLES[cur.role].label}</span>
            </p>
          )}
          <div className="label">Why it&apos;s built this way</div>
          <p style={{ marginTop: 4 }}>{cur.why}</p>
          <div className="label">{cur.kind === "automation" ? "How it runs" : "Key fields"}</div>
          <div className="row" style={{ gap: 4, margin: "6px 0 12px" }}>
            {cur.fields.map((f) => <span key={f} className="chip">{f}</span>)}
          </div>
          <div className="label">Connects to</div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {related.map((id) => <button key={id} className="small" onClick={() => setSel(id)}>{name(id)}</button>)}
          </div>
          {cur.live && <p className="mt" style={{ marginBottom: 0 }}><Link href={cur.live}>See it working in this demo →</Link></p>}
        </div>
      </div>

      <div className="card mt">
        <h2>How this got built</h2>
        <ol className="story">
          {BUILD_STORY.map((b) => (
            <li key={b.step}><strong>{b.step}.</strong> {b.text}</li>
          ))}
        </ol>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
          The lab time tracker (stage 4) is the part of this demo that runs, on invented sample data.
        </p>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Map /></Shell>;
}
