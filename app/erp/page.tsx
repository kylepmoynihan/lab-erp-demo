"use client";
import Link from "next/link";
import { useState } from "react";
import Shell from "@/components/Shell";
import { AREAS, FLOW, OBJECTS, type Obj } from "@/lib/erp";

const CREDIT = { kyle: "I built this", "kyle-marcus": "Built with Marcus" } as const;

function Card({ o, selected, related, onPick }: { o: Obj; selected: boolean; related: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="card"
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderColor: selected ? "var(--accent)" : related ? "var(--coral)" : "var(--line)",
        borderWidth: selected || related ? 2 : 1,
        opacity: selected || related || selected === null ? 1 : 1,
      }}
    >
      <div style={{ fontWeight: 600 }}>{o.name}</div>
      {o.credit && <span className="goal ok" style={{ marginTop: 4 }}>{CREDIT[o.credit]}</span>}
    </button>
  );
}

function Map() {
  const [sel, setSel] = useState<string>("orders");
  const cur = OBJECTS.find((o) => o.id === sel)!;
  const related = new Set([...cur.links, ...OBJECTS.filter((o) => o.links.includes(sel)).map((o) => o.id)]);
  const name = (id: string) => OBJECTS.find((o) => o.id === id)?.name ?? id;

  return (
    <>
      <h1>ERP map</h1>
      <p className="sub" style={{ maxWidth: 820 }}>
        The data model of the custom ERP the lab runs on. Its blueprint was the Salesforce org I architected for the company, plus the
        cooler and freeze-dryer tracking I designed but couldn&apos;t fit into Salesforce. The company moved to a custom build when it
        needed a full audit trail for cGMP certification. Click any object to see its fields and what it connects to. Green tags mark the modules
        I built; the lab time tracker is the part of this demo that runs.
      </p>

      <div className="card">
        <h2>How an order moves through the system</h2>
        <div className="row" style={{ gap: 6 }}>
          {FLOW.map((f, i) => (
            <span key={f.step} className="row" style={{ gap: 6 }}>
              <button onClick={() => setSel(f.obj)} className={sel === f.obj ? "primary" : ""}>{f.step}</button>
              {i < FLOW.length - 1 && <span className="muted">→</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="grid mt" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", alignItems: "start" }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", gridColumn: "span 2" }}>
          {AREAS.map((a) => (
            <div key={a.id}>
              <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em", margin: "4px 0 6px" }}>{a.name}</div>
              <div className="grid" style={{ gap: 6 }}>
                {OBJECTS.filter((o) => o.area === a.id).map((o) => (
                  <Card key={o.id} o={o} selected={o.id === sel} related={related.has(o.id)} onPick={() => setSel(o.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{ position: "sticky", top: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>{AREAS.find((a) => a.id === cur.area)!.name}</div>
          <h2 style={{ marginTop: 2 }}>{cur.name}</h2>
          {cur.credit && <p><span className="goal ok">{CREDIT[cur.credit]}</span></p>}
          <p>{cur.purpose}</p>
          <h2>Key fields</h2>
          <ul>{cur.fields.map((f) => <li key={f}>{f}</li>)}</ul>
          <h2>Connects to</h2>
          <div className="row" style={{ gap: 6 }}>
            {[...related].map((id) => <button key={id} onClick={() => setSel(id)}>{name(id)}</button>)}
          </div>
          {cur.live && <p className="mt"><Link href={cur.live}>See it working in this demo →</Link></p>}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Map /></Shell>;
}
