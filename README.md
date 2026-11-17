# Lab ERP

The data model of a small production lab's ERP, with its time-tracking module running on sample data:
QR time tracking, checkpoint compliance, and missed-scan alerts.

**Live demo (fictional sample data):** https://kylepmoynihan.com/lab-erp/

This is an open version of the ERP behind [Milk By Mom](https://kylepmoynihan.com/case-studies/milk-by-mom),
a startup that freeze-dries breast milk. The company moved from Salesforce to a custom build to get the audit
trail it needed for cGMP certification. The **ERP map** page lays out the full data model: orders, customers,
coolers, freeze dryers, quality records, shipping costs, and inventory. The lab time tracker is the module that runs in this demo. Product names, people, and data are left out. The workers,
orders, and numbers in the demo are invented.

## The problem

Hourly lab labor is a sizeable share of cost of goods, and there was no reliable record of where those
hours went. Workers move between stations all day (receiving, cutting, processing, the freeze dryers,
labeling, packing) and mostly speak Spanish.

## How it works

1. **A QR sticker at every station.** A worker scans it with a phone, taps their name, and picks the
   order from a list of active orders. Orders with a missed scan at that station are flagged at the top of
   the list. Scanning the same sticker again clocks them out. If they scan another station while still
   clocked in, the open task is closed and flagged for operations to check the time. The worker screens are
   Spanish first, with big buttons.
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

## How this got built

1. **Architected.** I architected the company's Salesforce org: the order model, orders flowing in from
   the online store, and status emails to customers as an order moves. Then I gathered the requirements
   for the next big pieces, machine and cooler tracking.
2. **Foundation.** The company needed a full audit trail for cGMP certification and moved to a custom
   build. Its quality consultant chose the stack and built the ERP's foundation from that architecture,
   including cooler and machine tracking.
3. **Designed with Marcus.** I specified what the lab time tracker had to do for workers on the floor and
   for operations, from my time in Amazon fulfillment centers. Marcus Hansen worked out how to build it:
   the scan app, worker sign-in and QR stickers.
4. **Planned and built.** I planned and built inventory, carrier invoice costing, store order financials
   for average order value, and the compliance model, alerts and digest on top of the time tracker.

Marcus and I built our parts with Claude Code.

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
2. Open the station's scan page (from the Overview), tap a worker's name, pick the flagged order (it sits
   at the top of the list), and start the task.
3. Back on **Alerts**, the miss now shows "Resolved by scan."
