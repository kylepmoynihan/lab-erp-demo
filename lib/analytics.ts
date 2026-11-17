// Turns raw scans into the numbers a lab manager runs on: checkpoint
// compliance, pace against benchmarks, and alerts for missed scans.
import { CHECKPOINTS, GOALS, STATIONS, TASKS, dryerSize, statusAt, statusSort, taskByKey, type Entry, type Order, type Task, type Worker } from "./domain";
import { MIN, at, dayStart, dow, fmtTime, isBusinessDay, median, phxDay } from "./time";

export type Data = { workers: Worker[]; orders: Order[]; entries: Entry[]; now: number };

const DAY = 86_400_000;

export function indexByOrder(entries: Entry[]) {
  const m = new Map<string, Entry[]>();
  for (const e of entries) for (const id of e.orders) (m.get(id) ?? m.set(id, []).get(id)!).push(e);
  return m;
}

// ---------- Checkpoint compliance ----------

export type CheckState = "tracked" | "missed" | "pending" | "n/a";

export function checkpointsFor(o: Order, byOrder: Map<string, Entry[]>, asOf: number) {
  const mine = byOrder.get(o.id) ?? [];
  return CHECKPOINTS.map((t) => {
    if (t.key === "rcv/B1" && !o.shippedIn) return { task: t, state: "n/a" as CheckState };
    const scanned = mine.some((e) => e.task === t.key && e.start <= asOf);
    const gateAt = o.statusAt[t.gate!];
    const crossed = gateAt !== undefined && gateAt <= asOf;
    return { task: t, state: (scanned ? "tracked" : crossed ? "missed" : "pending") as CheckState };
  });
}

/**
 * Share of orders with no missed checkpoint.
 * Active: every order received in the range, judged on the gates it has crossed so far.
 * Completed: only orders that have crossed every gate (shipped).
 */
export function compliance(d: Data, start: number, end: number, mode: "active" | "completed") {
  const byOrder = indexByOrder(d.entries);
  let judged = 0;
  let clean = 0;
  for (const o of d.orders) {
    const rec = o.statusAt.RECEIVED!;
    if (rec < start || rec >= end) continue;
    if (mode === "completed" && !(o.statusAt.SHIPPED && o.statusAt.SHIPPED <= end)) continue;
    judged += 1;
    if (!checkpointsFor(o, byOrder, end).some((c) => c.state === "missed")) clean += 1;
  }
  return { judged, clean, rate: judged ? clean / judged : NaN };
}

// ---------- Pace ----------

/** Net minutes worked, or null when the entry can't be timed (open, auto-closed, stamp, runaway). */
export function netMinutes(e: Entry) {
  if (e.end === null || e.autoClosed) return null;
  const t = taskByKey(e.task);
  if (t.measure === "stamp") return null;
  const m = (e.end - e.start) / MIN - e.pausedMin;
  return m > GOALS.trimMin || m <= 0 ? null : m;
}

/** Benchmark group: machine tasks are judged separately per dryer size. */
export const groupOf = (e: Entry) => {
  const t = taskByKey(e.task);
  return t.machine && e.machine ? `${t.key}|${dryerSize(e.machine)}` : t.key;
};
export const groupLabel = (g: string) => {
  const [k, size] = g.split("|");
  const t = taskByKey(k);
  return `${t.code} ${t.en}${size ? ` (${size} dryer)` : ""}`;
};

/**
 * Pace per entry. Minutes per ounce for weighed work, minutes per job for cleaning.
 * Receiving is a team batch: the day's total man-minutes over the day's combined weight,
 * and every person on the crew gets that same ratio. Man-hours basis: each person's own
 * clock counts at face value, with no division by team size.
 */
export function paceByEntry(d: Data) {
  const oz = new Map(d.orders.map((o) => [o.id, o.oz]));
  const pace = new Map<string, number>();
  const rcvDays = new Map<number, Entry[]>();
  for (const e of d.entries) {
    const t = taskByKey(e.task);
    const m = netMinutes(e);
    if (m === null) continue;
    if (t.measure === "batch") {
      const day = phxDay(e.start);
      (rcvDays.get(day) ?? rcvDays.set(day, []).get(day)!).push(e);
    } else if (t.measure === "job") {
      pace.set(e.id, m);
    } else {
      const w = e.orders.reduce((s, id) => s + (oz.get(id) ?? 0), 0);
      if (w > 0) pace.set(e.id, m / w);
    }
  }
  for (const list of rcvDays.values()) {
    const ids = new Set(list.flatMap((e) => e.orders));
    const w = [...ids].reduce((s, id) => s + (oz.get(id) ?? 0), 0);
    const man = list.reduce((s, e) => s + netMinutes(e)!, 0);
    if (w > 0) for (const e of list) pace.set(e.id, man / w);
  }
  return pace;
}

/** Each group's median pace over the 28 days before `end`. Needs 3+ entries. */
export function benchmarks(d: Data, pace: Map<string, number>, end: number) {
  const from = end - 28 * DAY;
  const groups = new Map<string, number[]>();
  for (const e of d.entries) {
    if (e.start < from || e.start >= end || !pace.has(e.id)) continue;
    const g = groupOf(e);
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(pace.get(e.id)!);
  }
  const out = new Map<string, number>();
  for (const [g, xs] of groups) if (xs.length >= 3) out.set(g, median(xs));
  return out;
}

export function stats(d: Data, start: number, end: number) {
  const pace = paceByEntry(d);
  const bench = benchmarks(d, pace, end);
  const inRange = d.entries.filter((e) => e.start >= start && e.start < end);
  const oz = new Map(d.orders.map((o) => [o.id, o.oz]));

  // Headline tiles
  const completed = inRange.filter((e) => e.end !== null);
  const netHours = inRange.reduce((s, e) => s + (netMinutes(e) ?? 0), 0) / 60;
  const processedOrders = new Set(inRange.filter((e) => e.task === "prc/B5" && e.end !== null).flatMap((e) => e.orders));
  const ozProcessed = [...processedOrders].reduce((s, id) => s + (oz.get(id) ?? 0), 0);
  const clockedIn = new Set(d.entries.filter((e) => e.end === null).map((e) => e.workerId));

  // Duration time-to-goal: on pace if no slower than the benchmark plus the band.
  // The band is one-sided: working fast is never a miss.
  let judged = 0;
  let onPace = 0;
  for (const e of inRange) {
    const b = bench.get(groupOf(e));
    if (b === undefined || !pace.has(e.id)) continue;
    judged += 1;
    if (pace.get(e.id)! <= b * (1 + GOALS.band)) onPace += 1;
  }

  // Groups in range: ounces per hour (or minutes per job), slowest first.
  const groupPaces = new Map<string, number[]>();
  for (const e of inRange) {
    if (!pace.has(e.id)) continue;
    const g = groupOf(e);
    (groupPaces.get(g) ?? groupPaces.set(g, []).get(g)!).push(pace.get(e.id)!);
  }
  const groups = [...groupPaces].map(([g, xs]) => {
    const t = taskByKey(g.split("|")[0]);
    const med = median(xs);
    return { group: g, label: groupLabel(g), task: t, entries: xs.length, medianPace: med, ozPerHour: t.measure === "job" ? null : 60 / med };
  });
  const weighed = groups.filter((g) => g.ozPerHour !== null).sort((a, b) => a.ozPerHour! - b.ozPerHour!);
  const cleaning = groups.filter((g) => g.ozPerHour === null).sort((a, b) => b.medianPace - a.medianPace);

  // Worker benchmarks: each worker's median vs the group median. 3+ entries.
  const perWorker = new Map<string, Map<string, number[]>>();
  for (const e of inRange) {
    if (!pace.has(e.id)) continue;
    const g = groupOf(e);
    const wm = perWorker.get(e.workerId) ?? perWorker.set(e.workerId, new Map()).get(e.workerId)!;
    (wm.get(g) ?? wm.set(g, []).get(g)!).push(pace.get(e.id)!);
  }
  const workerRows = d.workers
    .filter((w) => w.active)
    .map((w) => {
      const cells = new Map<string, { ratio: number; n: number }>();
      for (const [g, xs] of perWorker.get(w.id) ?? []) {
        const groupMed = median(groupPaces.get(g)!);
        if (xs.length >= 3) cells.set(g, { ratio: median(xs) / groupMed, n: xs.length });
      }
      return { worker: w, cells };
    });

  // Left open: auto-closed entries, plus this week vs last week.
  const today = phxDay(end);
  const weekStart = dayStart(today - ((dow(today) + 6) % 7));
  const leftOpen = (a: number, b: number) => d.entries.filter((e) => e.autoClosed && e.start >= a && e.start < b).length;

  return {
    pace,
    bench,
    tiles: { completed: completed.length, netHours, ozProcessed, clockedIn: clockedIn.size },
    onPace: { judged, onPace, rate: judged ? onPace / judged : NaN },
    leftOpen: { range: leftOpen(start, end), thisWeek: leftOpen(weekStart, end), lastWeek: leftOpen(weekStart - 7 * DAY, weekStart) },
    weighed,
    cleaning,
    workerRows,
    groupKeys: [...groupPaces.keys()].sort((a, b) => {
      const ia = TASKS.findIndex((t) => t.key === a.split("|")[0]);
      const ib = TASKS.findIndex((t) => t.key === b.split("|")[0]);
      const size = (g: string) => ["M", "L", "XL"].indexOf(g.split("|")[1] ?? "");
      return ia - ib || size(a) - size(b);
    }),
    perWorker,
  };
}

// ---------- Alerts ----------

export type Alert = {
  id: string;
  order: Order;
  task: Task;
  kind: "missed" | "left-open" | "forgot-clockout";
  rule: string;
  detectedAt: number;
  statusAtDetect: string;
  resolvedByScanAt?: number;
  roster: { worker: Worker; first: number; last: number }[];
};

/**
 * A checkpoint is missed when there is evidence the step happened (weights keyed,
 * or the order moved past the step's gate) and nobody scanned it. Evidence usually
 * shows up before the gate, so most misses are caught while the batch is still in-house.
 */
export function detectAlerts(d: Data): Alert[] {
  const byOrder = indexByOrder(d.entries);
  const out: Alert[] = [];
  for (const o of d.orders) {
    const mine = byOrder.get(o.id) ?? [];
    for (const t of CHECKPOINTS) {
      if (t.key === "rcv/B1" && !o.shippedIn) continue;
      const candidates: { at: number; rule: string }[] = [];
      if (t.key === "rcv/B1") candidates.push({ at: at(phxDay(o.statusAt.RECEIVED!), 18), rule: "Weighed in with no receiving scan that day" });
      if (t.key === "cut/B3" && o.cutWeightsAt) candidates.push({ at: o.cutWeightsAt + 15 * MIN, rule: "Cut weights entered, no cutting scan" });
      if (t.key === "prc/B5" && o.bagWeightsAt) candidates.push({ at: o.bagWeightsAt + 15 * MIN, rule: "Bag weights entered, no processing scan" });
      const gateAt = o.statusAt[t.gate!];
      if (gateAt !== undefined) candidates.push({ at: gateAt, rule: `Reached ${t.gate === "SHIPPED" ? "Shipped" : t.gate === "DRYING" ? "Drying" : "Final prep"} with no scan` });
      const first = candidates.filter((c) => c.at <= d.now).sort((a, b) => a.at - b.at)[0];
      if (!first) continue;
      const scans = mine.filter((e) => e.task === t.key);
      if (scans.some((e) => e.start <= first.at)) continue;
      const late = scans.filter((e) => e.start <= d.now).sort((a, b) => a.start - b.start)[0];
      out.push(makeAlert(d, o, t, "missed", first.rule, first.at, late?.start));
    }
    // Forgotten clock-out: still clocked in well after the weights for that step landed.
    for (const [key, evidence] of [["cut/B3", o.cutWeightsAt], ["prc/B5", o.bagWeightsAt]] as const) {
      if (!evidence) continue;
      const open = mine.find((e) => e.task === key && e.end === null);
      const detect = evidence + GOALS.clockoutGraceMin * MIN;
      if (open && detect <= d.now) out.push(makeAlert(d, o, taskByKey(key), "left-open", "Still clocked in after the weights were entered", detect));
    }
  }
  // Forgot to clock out: the worker scanned in at another station while this task was still open.
  for (const e of d.entries) {
    if (!e.forgotClockOut || e.end === null || e.end > d.now) continue;
    const o = d.orders.find((x) => x.id === e.orders[0]);
    if (!o) continue;
    const other = STATIONS.find((s) => s.code === e.forgotClockOut);
    const worker = d.workers.find((w) => w.id === e.workerId);
    const a = makeAlert(d, o, taskByKey(e.task), "forgot-clockout",
      `${worker?.name ?? "A worker"} scanned in at ${other?.en ?? e.forgotClockOut} without clocking out here`, e.end);
    out.push({ ...a, id: `${a.id}|${e.id}` });
  }
  return out;
}

function makeAlert(d: Data, o: Order, t: Task, kind: Alert["kind"], rule: string, detectedAt: number, resolvedByScanAt?: number): Alert {
  // Who was there: anchored on the days the evidence says the work happened.
  let days: number[];
  if (t.key === "cut/B3" && o.cutWeightsAt) days = [phxDay(o.cutWeightsAt)];
  else if (t.machine && o.statusAt.QC) days = [phxDay(o.statusAt.QC)];
  else days = [phxDay(detectedAt), phxDay(detectedAt) - 1];
  const at = new Map<string, { first: number; last: number }>();
  for (const e of d.entries) {
    if (taskByKey(e.task).station !== t.station || !days.includes(phxDay(e.start))) continue;
    const cur = at.get(e.workerId);
    const last = e.end ?? d.now;
    at.set(e.workerId, cur ? { first: Math.min(cur.first, e.start), last: Math.max(cur.last, last) } : { first: e.start, last });
  }
  const roster = [...at].map(([id, v]) => ({ worker: d.workers.find((w) => w.id === id)!, ...v })).sort((a, b) => a.first - b.first);
  const s = statusAt(o, detectedAt);
  return {
    id: `${o.id}|${t.key}|${kind}`,
    order: o,
    task: t,
    kind,
    rule,
    detectedAt,
    statusAtDetect: s ?? "RECEIVED",
    resolvedByScanAt: resolvedByScanAt,
    roster,
  };
}

/** Open rows first; batches still in the building before shipped ones; then newest. */
export function fixabilitySort(alerts: Alert[], isOpen: (a: Alert) => boolean, now: number) {
  const inHouse = (a: Alert) => (statusAt(a.order, now) === "SHIPPED" ? 1 : 0);
  return [...alerts].sort((a, b) => {
    const oa = isOpen(a) ? 0 : 1;
    const ob = isOpen(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    if (oa === 0 && inHouse(a) !== inHouse(b)) return inHouse(a) - inHouse(b);
    return b.detectedAt - a.detectedAt;
  });
}

// ---------- Digest ----------

/** Digest goes out at 12:30 PM and 4:30 PM, Arizona time, on business days. */
export function digestSlots(now: number) {
  const slots: number[] = [];
  for (let day = phxDay(now) - 10; day <= phxDay(now); day++) {
    if (!isBusinessDay(day)) continue;
    for (const h of [12.5, 16.5]) if (at(day, h) <= now) slots.push(at(day, h));
  }
  return slots;
}

export const slotLabel = (ts: number) => fmtTime(ts);
export const stationName = (code: string) => STATIONS.find((s) => s.code === code)!;
export const TASK_LIST = TASKS;
export { statusSort };
