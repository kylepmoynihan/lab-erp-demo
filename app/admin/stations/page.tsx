"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Shell from "@/components/Shell";
import { STATIONS, TASKS } from "@/lib/domain";
import { BASE_PATH } from "@/lib/store";

function Sticker({ code, es, en }: { code: string; es: string; en: string }) {
  const [svg, setSvg] = useState("");
  const url = typeof window === "undefined" ? "" : `${window.location.origin}${BASE_PATH}/s/${code}/`;
  useEffect(() => {
    if (url) QRCode.toString(url, { type: "svg", margin: 1, width: 180 }).then(setSvg);
  }, [url]);
  return (
    <div className="card" style={{ textAlign: "center", breakInside: "avoid" }}>
      <div style={{ width: 180, margin: "0 auto", background: "#fff", borderRadius: 6 }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{es}</div>
      <div className="muted">{en}</div>
      <div style={{ color: "var(--coral)", fontWeight: 700, letterSpacing: ".1em", marginTop: 4 }}>{code.toUpperCase()}</div>
      <div className="muted noprint" style={{ fontSize: 11, marginTop: 6, wordBreak: "break-all" }}>{url}</div>
    </div>
  );
}

function Stations() {
  return (
    <>
      <div className="row">
        <div>
          <h1>Stations &amp; QR stickers</h1>
          <p className="sub">One sticker per station. Spanish name large, English small. Scanning opens that station&apos;s page with its tasks.</p>
        </div>
        <span className="spacer" />
        <button className="noprint" onClick={() => window.print()}>Print stickers</button>
      </div>
      <div className="grid g3">
        {STATIONS.map((s) => <Sticker key={s.code} {...s} />)}
      </div>
      <div className="card mt noprint tablewrap">
        <h2>Tasks</h2>
        <table>
          <thead><tr><th>Station</th><th>Code</th><th>Task</th><th>Tarea</th><th>Measured by</th><th>Checkpoint</th></tr></thead>
          <tbody>
            {TASKS.map((t) => (
              <tr key={t.key}>
                <td>{STATIONS.find((s) => s.code === t.station)!.en}</td>
                <td>{t.code}</td>
                <td>{t.en}</td>
                <td>{t.es}</td>
                <td>{{ oz: "minutes per oz", job: "minutes per job", stamp: "instant stamp", batch: "team batch per oz" }[t.measure]}{t.machine ? ", by dryer size" : ""}</td>
                <td>{t.gate ? `scan required before ${t.gate.replace("_", " ").toLowerCase()}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Stations /></Shell>;
}
