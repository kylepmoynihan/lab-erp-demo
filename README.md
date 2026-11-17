# Lab ERP

The data model of a small production lab's ERP, with its time-tracking module running on sample data:
QR time tracking, checkpoint compliance, and missed-scan alerts.

**Live demo (fictional sample data):** https://kylepmoynihan.com/lab-erp/

This is an open version of the ERP behind [Milk By Mom](https://kylepmoynihan.com/case-studies/milk-by-mom),
a startup that freeze-dries breast milk. The company moved from Salesforce to a custom build to get the audit
trail it needed for cGMP certification. The **ERP map** page lays out the full data model: orders, customers,
coolers, freeze dryers, quality records, shipping costs, and inventory. The lab time tracker that Marcus Hansen
and I built in 2026 is the module that runs in this demo. Product names, people, and data are left out. The workers,
orders, and numbers in the demo are invented.

## The problem

Hourly lab labor is a sizeable share of cost of goods, and there was no reliable record of where those
hours went. Workers move between stations all day (receiving, cutting, processing, the freeze dryers,
labeling, packing) and mostly speak Spanish.

## How it works

1. **A QR sticker at every station.** A worker scans it with a phone, picks their name, enters a PIN,
   and starts or finishes a task on an order. The worker screens are Spanish first, with big buttons.
2. **Checkpoints.** Each key production step has a gate: once an order reaches a certain status, a scan
   for that step must exist. Tracking compliance is the share of orders with no missed checkpoint.
3. **Evidence-based alerts.** Weights are keyed at the cutting and processing stations as part of the
   work. If weights show up and nobody scanned in at that station, the miss is flagged within 15 minutes,
   usually while the batch is still in the building. Each alert shows who was clocked in at that station
   that day, as a starting point for a conversation. A late scan resolves the alert on its own.
4. **Pace against benchmarks.** Minutes per ounce for weighed work, minutes per job for cleaning, split by
   dryer size where it matters. Medians, never averages. A task is on pace if it's no slower than its
   28-day benchmark plus 20%; working fast is never a miss. Receiving is a team batch, so the crew's
   total man-minutes are divided by the day's combined weight.
5. **A twice-daily digest** at 12:30 and 4:30 PM to the manager and leads (never floor staff). It
   replaced one email per miss, which people had learned to ignore.

## Who built what

The ERP's blueprint was the Salesforce org I architected for the company, including the cooler and
freeze-dryer tracking I designed but couldn't fit into Salesforce. The company's quality consultant built
the ERP's foundation from it. Inside the ERP I built the inventory module, the carrier invoice import that
puts true shipping cost on each order, and the store order financials behind average order value.

For the lab time tracker, I designed the system from my background in Amazon fulfillment center operations: what the worker side
needed and what the operations side needed to see. Marcus built the tracking base (stations, tasks,
worker logins, the scan app, and the QR sticker generator). I built the compliance model, the KPIs and
benchmarks, the alerts and who-was-there roster, and the digest. We built it with Claude Code.

## Stack

Production: Next.js and Supabase (Postgres, row-level security, pg_cron for detection and the digest).
See [`supabase/schema.sql`](supabase/schema.sql).

This demo: the same logic in TypeScript ([`lib/analytics.ts`](lib/analytics.ts)) running in the browser
on generated sample data ([`lib/seed.ts`](lib/seed.ts)), exported as a static site. Your scans are kept
in your browser only and reset each day.

```bash
npm install
npm run dev     # http://localhost:3000/lab-erp/
```

## Try it

1. Open **Alerts** and note an order flagged on a batch still in the building.
2. Open the station's scan page (from the Overview), sign in as a worker (the PIN is shown), and start
   that task on the flagged order.
3. Back on **Alerts**, the miss now shows "Resolved by scan."
