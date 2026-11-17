// Generates six weeks of fictional lab activity, ending at "now".
// Every name, order and weight here is invented. A few misses are planted on
// purpose so the compliance numbers and alerts have something to find.
import { DRYERS, type Entry, type Order, type Worker } from "./domain";
import { MIN, addBusinessDays, at, dayStart, isBusinessDay, phxDay } from "./time";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORKERS: (Worker & { factor: number })[] = [
  { id: "w1", name: "Ana Morales", pin: "1111", stations: null, active: true, factor: 0.85 },
  { id: "w2", name: "Luis Herrera", pin: "2222", stations: ["rcv", "cut", "prc"], active: true, factor: 1.0 },
  { id: "w3", name: "Marisol Vega", pin: "3333", stations: null, active: true, factor: 0.95 },
  { id: "w4", name: "Diego Ramírez", pin: "4444", stations: ["dry", "pck"], active: true, factor: 1.05 },
  { id: "w5", name: "Rosa Delgado", pin: "5555", stations: ["cut", "prc", "pck"], active: true, factor: 1.45 },
  { id: "w6", name: "Javier Soto", pin: "6666", stations: ["rcv", "dry"], active: true, factor: 1.1 },
  { id: "w7", name: "Lupita Cruz", pin: "7777", stations: ["prc", "pck"], active: true, factor: 0.9 },
  { id: "w8", name: "Tomás Ortega", pin: "8888", stations: ["rcv", "cut", "dry"], active: true, factor: 1.25 },
];

// Base pace in minutes per ounce, or minutes per job for cleaning.
const BASE = { "rcv/B1": 0.03, "cut/B3": 0.1, "prc/B5": 0.08, "dry/A1": 0.03, "pck/P5": 0.12 };
const CLEAN_MIN = { M: 20, L: 28, XL: 38 };

export type Dataset = { workers: Worker[]; orders: Order[]; entries: Entry[]; now: number };

export function generate(realNow: number): Dataset {
  const today = phxDay(realNow);
  const now = at(today + 14, 23); // build the full schedule, trim to realNow below
  const r = rng(20261117 + today);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const noise = () => between(0.85, 1.2);
  const canWork = (station: string) => WORKERS.filter((w) => !w.stations || w.stations.includes(station));

  const firstDay = today - 45;
  const orders: Order[] = [];
  const entries: Entry[] = [];
  let seq = 0;
  let orderNo = 10000 + (firstDay % 90) * 10;
  // One business day about two and a half weeks back where nobody scanned receiving.
  let missedReceivingDay = today - 17;
  while (!isBusinessDay(missedReceivingDay)) missedReceivingDay -= 1;

  const addEntry = (e: Omit<Entry, "id" | "source" | "pausedMin"> & { pausedMin?: number }) => {
    if (e.start > now) return;
    const entry: Entry = { pausedMin: 0, ...e, id: `e${++seq}`, source: "seed" };
    if (entry.end !== null && r() < 0.025 && e.task !== "dry/B6") {
      entry.autoClosed = true; // forgot to clock out; the 6 PM sweep closed it
      entry.end = at(phxDay(entry.start), 18);
    }
    entries.push(entry);
  };
  /** Mandatory step: usually scanned, sometimes missed, sometimes scanned late. */
  const step = (e: Parameters<typeof addEntry>[0], lateFrom: number) => {
    const roll = r();
    if (roll < 0.03) return; // missed, never scanned
    if (roll < 0.05) {
      const lateStart = lateFrom + between(60, 240) * MIN;
      return addEntry({ ...e, start: lateStart, end: lateStart + (e.end! - e.start) });
    }
    addEntry(e);
  };

  for (let d = firstDay; d <= today; d++) {
    if (!isBusinessDay(d)) continue;
    const dayOrders: Order[] = [];
    const count = 4 + Math.floor(r() * 4);
    for (let i = 0; i < count; i++) {
      const received = at(d, between(8, 10.5));
      if (received > now) continue;
      const o: Order = {
        id: `#${++orderNo}`,
        oz: Math.round(between(150, 900)),
        shippedIn: r() < 0.9,
        statusAt: { RECEIVED: received },
      };
      dayOrders.push(o);
      orders.push(o);
    }

    // Receiving is a team batch: two people weigh the whole day's shipments.
    const shipped = dayOrders.filter((o) => o.shippedIn);
    if (shipped.length && d !== missedReceivingDay) {
      const crew = [pick(canWork("rcv")), pick(canWork("rcv"))].filter((w, i, a) => a.indexOf(w) === i);
      const totalOz = shipped.reduce((s, o) => s + o.oz, 0);
      for (const w of crew) {
        const start = at(d, between(7.75, 8.25));
        addEntry({
          workerId: w.id,
          task: "rcv/B1",
          start,
          end: start + totalOz * BASE["rcv/B1"] * w.factor * noise() * MIN,
          orders: shipped.map((o) => o.id),
          partners: crew.filter((x) => x !== w).map((x) => x.id),
        });
      }
    }

    for (const o of dayOrders) {
      // Cutting and processing, same day or next business day.
      const prepDay = r() < 0.6 ? d : addBusinessDays(d, 1);
      const cutStart = Math.max(at(prepDay, between(8.5, 13)), o.statusAt.RECEIVED! + 30 * MIN);
      const cutter = pick(canWork("cut"));
      const cutEnd = cutStart + o.oz * BASE["cut/B3"] * cutter.factor * noise() * MIN;
      if (cutStart > now) continue;
      o.statusAt.DRYER_PREP = cutStart;
      o.cutWeightsAt = cutStart + (cutEnd - cutStart) * 0.8;
      step({ workerId: cutter.id, task: "cut/B3", start: cutStart, end: cutEnd, orders: [o.id] }, o.cutWeightsAt ?? cutEnd);

      const procStart = cutEnd + between(10, 40) * MIN;
      const proc = pick(canWork("prc"));
      const procEnd = procStart + o.oz * BASE["prc/B5"] * proc.factor * noise() * MIN;
      if (procStart > now) continue;
      o.bagWeightsAt = procEnd - 5 * MIN;
      step({ workerId: proc.id, task: "prc/B5", start: procStart, end: procEnd, orders: [o.id] }, o.bagWeightsAt ?? procEnd);

      // Load a dryer (an instant stamp with the lot number).
      const loadAt = procEnd + between(15, 45) * MIN;
      if (loadAt > now) continue;
      const dryer = pick(DRYERS);
      o.dryer = dryer.id;
      o.lot = `L${String(phxDay(loadAt) % 1000).padStart(3, "0")}-${dryer.id}`;
      o.statusAt.DRYING = loadAt;
      const loader = pick(canWork("dry"));
      addEntry({ workerId: loader.id, task: "dry/B6", start: loadAt, end: loadAt, orders: [o.id], machine: dryer.id, lot: o.lot });

      // Unload one or two business days later, inspect, clean the dryer.
      const unloadDay = addBusinessDays(phxDay(loadAt), r() < 0.5 ? 1 : 2);
      const unloadAt = at(unloadDay, between(8, 10));
      if (unloadAt > now) continue;
      o.statusAt.QC = unloadAt;
      const insp = pick(canWork("dry"));
      const inspEnd = unloadAt + o.oz * BASE["dry/A1"] * insp.factor * noise() * MIN;
      step({ workerId: insp.id, task: "dry/A1", start: unloadAt, end: inspEnd, orders: [o.id], machine: dryer.id, lot: o.lot }, unloadAt);
      const cleanStart = inspEnd + between(5, 20) * MIN;
      const cleaner = pick(canWork("dry"));
      step(
        { workerId: cleaner.id, task: "dry/A7", start: cleanStart, end: cleanStart + CLEAN_MIN[dryer.size] * cleaner.factor * noise() * MIN, orders: [o.id], machine: dryer.id },
        cleanStart,
      );

      // Final prep the next business day: pack, then ship.
      const prepAt = at(addBusinessDays(unloadDay, 1), between(8, 9));
      if (prepAt > now) continue;
      o.statusAt.FINAL_PREP = prepAt;
      const packStart = prepAt + between(30, 240) * MIN;
      const packer = pick(canWork("pck"));
      const packEnd = packStart + o.oz * BASE["pck/P5"] * packer.factor * noise() * MIN;
      const shipAt = packEnd + between(60, 180) * MIN;
      step({ workerId: packer.id, task: "pck/P5", start: packStart, end: packEnd, orders: [o.id] }, shipAt);
      o.statusAt.SHIPPED = shipAt;
    }
  }

  return trim({ orders, entries }, realNow, today);
}

/** Cut the full schedule off at the real current time and plant the demo cases. */
function trim(full: { orders: Order[]; entries: Entry[] }, now: number, today: number): Dataset {
  const orders: Order[] = [];
  for (const src of full.orders) {
    if (src.statusAt.RECEIVED! > now) continue;
    const o: Order = { ...src, statusAt: {} };
    for (const [k, v] of Object.entries(src.statusAt)) if (v! <= now) o.statusAt[k as keyof Order["statusAt"]] = v;
    if (o.cutWeightsAt && o.cutWeightsAt > now) delete o.cutWeightsAt;
    if (o.bagWeightsAt && o.bagWeightsAt > now) delete o.bagWeightsAt;
    if (!o.statusAt.DRYING) { delete o.lot; delete o.dryer; }
    orders.push(o);
  }
  const live = new Set(orders.map((o) => o.id));
  let entries = full.entries
    .filter((e) => e.start <= now && e.orders.some((id) => live.has(id)))
    .map((e) => {
      if (e.end !== null && e.end > now) return { ...e, end: null, autoClosed: false }; // still clocked in
      return e;
    });

  // Plant misses on batches still in the building, so the alerts page always
  // shows the case the system was built for: catch it before it ships.
  const inHouse = orders.filter((o) => !o.statusAt.SHIPPED);
  const drop = (o: Order | undefined, task: string) => {
    if (o) entries = entries.filter((e) => !(e.task === task && e.orders.includes(o.id)));
  };
  drop(inHouse.filter((o) => o.cutWeightsAt && o.cutWeightsAt + 20 * MIN < now).sort((a, b) => b.cutWeightsAt! - a.cutWeightsAt!)[1], "cut/B3");
  drop(inHouse.find((o) => o.statusAt.FINAL_PREP), "dry/A1");
  drop(inHouse.filter((o) => o.bagWeightsAt && o.bagWeightsAt + 20 * MIN < now).sort((a, b) => b.bagWeightsAt! - a.bagWeightsAt!)[3], "prc/B5");

  // Plant one forgotten clock-out today: cutting still open well after its weights.
  const todays = entries.filter(
    (e) => e.task === "cut/B3" && phxDay(e.start) === today && e.end !== null && !e.autoClosed && e.end + 45 * MIN < now,
  );
  if (todays.length) todays[0] = Object.assign(todays[0], { end: null });

  // The 6 PM sweep closes anything left open on earlier days.
  entries = entries.map((e) =>
    e.end === null && phxDay(e.start) < today ? { ...e, end: at(phxDay(e.start), 18), autoClosed: true } : e,
  );
  return { workers: WORKERS.map(({ factor, ...w }) => w), orders, entries, now };
}

export const demoStartOfDay = (now: number) => dayStart(phxDay(now));
