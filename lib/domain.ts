// Stations, tasks, order statuses and the checkpoint rules.
// The lab freeze-dries breast milk: customers ship frozen milk in, the lab
// thaws, blends and freeze-dries it, then packs the powder and ships it back.

export type StatusCode = "RECEIVED" | "DRYER_PREP" | "DRYING" | "QC" | "FINAL_PREP" | "SHIPPED";

export const STATUSES: { code: StatusCode; label: string; sort: number }[] = [
  { code: "RECEIVED", label: "Received", sort: 1 },
  { code: "DRYER_PREP", label: "Dryer prep", sort: 2 },
  { code: "DRYING", label: "Drying", sort: 3 },
  { code: "QC", label: "QC", sort: 4 },
  { code: "FINAL_PREP", label: "Final prep", sort: 5 },
  { code: "SHIPPED", label: "Shipped", sort: 6 },
];
export const statusSort = (s: StatusCode) => STATUSES.find((x) => x.code === s)!.sort;
export const statusLabel = (s: StatusCode) => STATUSES.find((x) => x.code === s)!.label;

export type Station = { code: string; en: string; es: string };
export const STATIONS: Station[] = [
  { code: "rcv", en: "Receiving", es: "Recepción" },
  { code: "cut", en: "Cutting Station", es: "Estación de Corte" },
  { code: "prc", en: "Processing Station", es: "Estación de Proceso" },
  { code: "dry", en: "Dryers", es: "Liofilizadoras" },
  { code: "pck", en: "Packing Station", es: "Estación de Empaque" },
];

export type Measure = "oz" | "job" | "stamp" | "batch";

export type Task = {
  key: string; // always station/code: codes are only unique within a station
  station: string;
  code: string;
  en: string;
  es: string;
  measure: Measure; // how pace is judged
  machine?: boolean; // captures a dryer, benchmarks split by dryer size
  /** Mandatory checkpoint: once an order reaches this status, a scan must exist. */
  gate?: StatusCode;
};

export const TASKS: Task[] = [
  { key: "rcv/B1", station: "rcv", code: "B1", en: "Receive and weigh shipments", es: "Recibir y pesar envíos", measure: "batch", gate: "DRYING" },
  { key: "cut/B3", station: "cut", code: "B3", en: "Cut / remove plastic", es: "Cortar / retirar plástico", measure: "oz", gate: "DRYING" },
  { key: "prc/B5", station: "prc", code: "B5", en: "Blend and pour trays", es: "Licuar y servir charolas", measure: "oz", gate: "DRYING" },
  { key: "dry/B6", station: "dry", code: "B6", en: "Load dryer", es: "Cargar máquina", measure: "stamp", machine: true },
  { key: "dry/A1", station: "dry", code: "A1", en: "Unload and inspect batch", es: "Descargar e inspeccionar lote", measure: "oz", machine: true, gate: "FINAL_PREP" },
  { key: "dry/A7", station: "dry", code: "A7", en: "Clean dryer", es: "Limpiar máquina", measure: "job", machine: true, gate: "FINAL_PREP" },
  { key: "pck/P5", station: "pck", code: "P5", en: "Pack pouches", es: "Empacar sobres", measure: "oz", gate: "SHIPPED" },
];
export const taskByKey = (k: string) => TASKS.find((t) => t.key === k)!;
export const CHECKPOINTS = TASKS.filter((t) => t.gate);

export type DryerSize = "M" | "L" | "XL";
export const DRYERS: { id: string; size: DryerSize }[] = [
  { id: "D1", size: "M" },
  { id: "D2", size: "M" },
  { id: "D3", size: "L" },
  { id: "D4", size: "L" },
  { id: "D5", size: "XL" },
  { id: "D6", size: "XL" },
];
export const dryerSize = (id?: string) => DRYERS.find((d) => d.id === id)?.size;

export type Worker = { id: string; name: string; pin: string; stations: string[] | null; active: boolean };

export type Entry = {
  id: string;
  workerId: string;
  task: string; // task key
  start: number;
  end: number | null; // null = still clocked in
  pausedMin: number;
  pausedAt?: number; // set while the worker has the task paused
  orders: string[];
  machine?: string;
  lot?: string;
  partners?: string[]; // co-workers named on a team entry
  autoClosed?: boolean; // left open, closed by the 6 PM sweep: counts as done, no duration
  source: "seed" | "demo";
};

export type Order = {
  id: string;
  oz: number; // net weight at receipt
  shippedIn: boolean;
  statusAt: Partial<Record<StatusCode, number>>; // when the order entered each status
  cutWeightsAt?: number; // evidence: weights keyed at the cutting station
  bagWeightsAt?: number; // evidence: tray-bag weights entered after processing
  lot?: string;
  dryer?: string;
};

/** Status of an order at a moment in time. */
export function statusAt(o: Order, t: number): StatusCode | null {
  let cur: StatusCode | null = null;
  for (const s of STATUSES) {
    const ts = o.statusAt[s.code];
    if (ts !== undefined && ts <= t) cur = s.code;
  }
  return cur;
}

/** KPI goals (settings flags in the real system). */
export const GOALS = { compliance: 0.98, onPace: 0.9, band: 0.2, trimMin: 240, clockoutGraceMin: 30 };
