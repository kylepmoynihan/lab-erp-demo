// Data model of the full ERP, generalized from the production system.
// Table and field names are simplified; nothing here is customer data.

/** How this piece came to exist. Shown only when "Show who built what" is on. */
export type Role = "architected" | "requirements" | "designed" | "built";

export const ROLES: Record<Role, { label: string; color: string }> = {
  architected: { label: "From my Salesforce architecture", color: "#7a5af5" },
  requirements: { label: "I gathered the requirements", color: "#2f9bb3" },
  designed: { label: "I designed it, Marcus built it", color: "#d08a1e" },
  built: { label: "I planned and built it", color: "#1e9a5a" },
};

export type Obj = {
  id: string;
  name: string;
  stage: string;
  kind: "table" | "automation";
  why: string; // why it is built this way
  fields: string[];
  links: string[]; // ids of related objects
  role?: Role;
  live?: string; // path to a working page in this demo
};

/** The order's path through the business. Each object hangs off the stage where it is used. */
export const STAGES = [
  { id: "order", name: "Order placed", note: "Online store to ERP" },
  { id: "cooler", name: "Cooler out and back", note: "Cold chain to the customer and back" },
  { id: "received", name: "Milk received", note: "Weighed, checked, frozen" },
  { id: "prep", name: "Cut and processed", note: "Stations, scans, alerts" },
  { id: "dried", name: "Freeze-dried", note: "Machines, cycles, lots" },
  { id: "released", name: "Released", note: "Quality checks before shipping" },
  { id: "shipped", name: "Packed and shipped", note: "Packaging and supplies" },
  { id: "costed", name: "Costed", note: "True cost and margin per order" },
];

export const OBJECTS: Obj[] = [
  // Order placed
  { id: "orders", name: "Orders", stage: "order", kind: "table", role: "architected",
    why: "The center of the system. One order follows one customer's milk from the store to the final shipping cost, and every other record traces back to it. Ounces are tracked three times (ordered, received, actual) because each one can differ and each difference needs an explanation.",
    fields: ["order number", "store order number", "ordered oz", "received oz", "actual oz", "status", "order type (shipped in or local drop-off)", "received / shipped dates", "special instructions"],
    links: ["customers", "addresses", "line_items", "status_workflow", "store_sync", "status_emails", "coolers", "receipts", "cut_bags", "time_entries", "lots", "release_checks", "shipments", "carrier_invoices", "store_financials"] },
  { id: "store_sync", name: "Store order sync", stage: "order", kind: "automation", role: "architected",
    why: "Orders placed in the online store create the customer, address, order and line items automatically, so nobody retypes an order and the store order number stays attached for reconciliation.",
    fields: ["trigger: new store order", "creates or matches the customer", "creates order + line items"],
    links: ["orders", "customers", "addresses", "line_items"] },
  { id: "customers", name: "Customers", stage: "order", kind: "table", role: "architected",
    why: "Each parent who sends milk in. Kept separate from orders because many customers send milk more than once.",
    fields: ["name", "email", "phone", "default address"], links: ["orders", "addresses", "store_sync"] },
  { id: "addresses", name: "Addresses", stage: "order", kind: "table", role: "architected",
    why: "Stored once and reused across orders. The shipping zone on the address feeds shipping cost analysis later.",
    fields: ["street", "city", "state", "zip", "shipping zone"], links: ["customers", "orders"] },
  { id: "line_items", name: "Order line items", stage: "order", kind: "table", role: "architected",
    why: "What the customer bought: pouch formats, add-ons and services, priced from the catalog.",
    fields: ["product", "quantity", "price"], links: ["orders", "products"] },
  { id: "products", name: "Products", stage: "order", kind: "table", role: "architected",
    why: "Catalog of pouch formats and services, with the price each order line is charged at.",
    fields: ["SKU", "name", "oz per unit", "price"], links: ["line_items", "inventory_items"] },
  { id: "status_workflow", name: "Status workflow", stage: "order", kind: "table", role: "architected",
    why: "Statuses live in a table with a sort order instead of being hard-coded. Checkpoints and reports compare positions (\"has this order reached drying?\"), so a new status can be added without rewriting the rules.",
    fields: ["code", "label", "sort order"], links: ["orders", "status_emails", "time_entries"] },
  { id: "status_emails", name: "Status emails", stage: "order", kind: "automation", role: "architected",
    why: "When an order moves to a new status, the customer gets the email for that step, so parents know where their milk is without having to ask.",
    fields: ["trigger: order status change", "template per status", "sent log"], links: ["orders", "status_workflow"] },

  // Cooler out and back
  { id: "coolers", name: "Coolers", stage: "cooler", kind: "table", role: "requirements",
    why: "Insulated coolers are shipped to customers and come back full. Each one is tracked as an asset, so none get lost and every order can be traced to the cooler its milk traveled in.",
    fields: ["cooler ID", "size", "condition", "current location", "last order"], links: ["orders", "cooler_status"] },
  { id: "cooler_status", name: "Cooler status history", stage: "cooler", kind: "table", role: "requirements",
    why: "Every move a cooler makes is a new row, so the current location is just the latest row and the full history is there for an audit.",
    fields: ["cooler", "status (at lab / out to customer / in transit back)", "since", "tracking number"], links: ["coolers"] },

  // Milk received
  { id: "receipts", name: "Receipts and weight checks", stage: "received", kind: "table",
    why: "Weight and temperature at arrival. The received weight is checked against what the customer said they sent.",
    fields: ["order", "received at", "weight oz", "temperature °F", "disposition"], links: ["orders", "freezer_storage", "time_entries"] },
  { id: "freezer_storage", name: "Freezer storage", stage: "received", kind: "table",
    why: "Which freezer holds each order's milk before processing, with temperature readings.",
    fields: ["freezer", "order", "in / out", "readings"], links: ["receipts"] },

  // Cut and processed: the lab time tracker
  { id: "stations", name: "Stations", stage: "prep", kind: "table", role: "designed", live: "/admin/stations/",
    why: "Each work area has a QR sticker. Workers scan the station they are standing at, so the station is never typed in or guessed.",
    fields: ["code", "name (EN / ES)", "active"], links: ["tasks"] },
  { id: "tasks", name: "Tasks", stage: "prep", kind: "table", role: "designed", live: "/admin/stations/",
    why: "Each task says how its work is measured (per ounce, per job, or an instant stamp) and which order status makes it mandatory. That one setting drives the compliance checks.",
    fields: ["station", "code", "name (EN / ES)", "measure", "checkpoint status"], links: ["stations", "time_entries", "status_workflow"] },
  { id: "workers", name: "Lab workers", stage: "prep", kind: "table", role: "designed",
    why: "Roster with the stations each person is trained for. Workers sign in with a name and PIN on a shared phone screen, no accounts or passwords.",
    fields: ["name", "allowed stations", "PIN", "active"], links: ["time_entries"] },
  { id: "time_entries", name: "Time entries", stage: "prep", kind: "table", role: "designed", live: "/admin/log/",
    why: "One scan-in to scan-out on a task, linked to the orders worked. Receiving is logged as a team batch across the day's orders. A worker can only have one open entry at a time, which the database enforces.",
    fields: ["worker", "task", "started / ended", "paused minutes", "orders", "machine", "lot", "team partners", "auto-closed"],
    links: ["workers", "tasks", "orders", "receipts", "cut_bags", "lots", "lab_alerts", "clockout_sweep", "status_workflow"] },
  { id: "cut_bags", name: "Cut bag weights", stage: "prep", kind: "table",
    why: "Weights keyed at the cutting and processing stations as part of the work. They double as proof that work happened, which is how missed scans get caught.",
    fields: ["order", "bag weight", "keyed at"], links: ["orders", "time_entries", "scan_detection"] },
  { id: "scan_detection", name: "Missed-scan detection", stage: "prep", kind: "automation", role: "built", live: "/admin/alerts/",
    why: "Runs every few minutes. If weights exist for an order and nobody was scanned in at that station, it raises an alert within 15 minutes, while the batch is usually still in the building. It works from evidence instead of relying on workers to report their own misses.",
    fields: ["schedule: every few minutes", "rule: weights with no scan", "rule: still clocked in 30+ min after weights"], links: ["cut_bags", "time_entries", "lab_alerts"] },
  { id: "lab_alerts", name: "Tracking alerts", stage: "prep", kind: "table", role: "built", live: "/admin/alerts/",
    why: "A ledger of misses. Each alert lists who was at that station that day as a starting point for a conversation. A late scan resolves it on its own; the manager marks the rest as addressed.",
    fields: ["order", "task", "rule", "detected at", "reported at", "resolved / addressed"], links: ["time_entries", "orders", "scan_detection", "digest"] },
  { id: "digest", name: "Twice-daily digest", stage: "prep", kind: "automation", role: "built", live: "/admin/digest/",
    why: "At 12:30 and 4:30 PM the manager and leads get one email with every new miss, sorted by what can still be fixed. It replaced one email per miss, which people had learned to ignore.",
    fields: ["schedule: 12:30 and 4:30 PM, business days", "recipients: manager and leads", "marks alerts reported"], links: ["lab_alerts"] },
  { id: "clockout_sweep", name: "6 PM clock-out sweep", stage: "prep", kind: "automation",
    why: "Closes any entry left open at the end of the day and flags it as auto-closed, so one forgotten scan-out can't inflate the hours.",
    fields: ["schedule: 6 PM daily", "sets end time", "flags auto-closed"], links: ["time_entries"] },

  // Freeze-dried
  { id: "freeze_dryers", name: "Freeze dryers", stage: "dried", kind: "table", role: "requirements",
    why: "Every machine, its size and its service history. Size matters because loading, unloading and cleaning times depend on it.",
    fields: ["machine ID", "size", "status", "service log"], links: ["lots", "dryer_cycles", "dryer_queue"] },
  { id: "dryer_queue", name: "Dryer queue", stage: "dried", kind: "table", role: "requirements",
    why: "The planning board: which orders go into which machine next.",
    fields: ["machine", "position", "orders", "planned start"], links: ["freeze_dryers", "orders"] },
  { id: "dryer_cycles", name: "Dryer cycles", stage: "dried", kind: "table", role: "requirements",
    why: "Each run of a machine from load to unload, so any batch can be traced to the exact run it was in.",
    fields: ["machine", "lot", "loaded at", "unloaded at"], links: ["freeze_dryers", "lots"] },
  { id: "lots", name: "Lots", stage: "dried", kind: "table", role: "requirements",
    why: "A freeze-drying batch. Lots tie orders to a machine and a cycle, which is the backbone of traceability for an audit.",
    fields: ["lot number", "machine", "cycle start / end", "orders"], links: ["orders", "freeze_dryers", "dryer_cycles", "release_checks", "lab_tests", "time_entries"] },

  // Released
  { id: "release_checks", name: "Release checks", stage: "released", kind: "table",
    why: "The checks a lot has to pass before it can ship, with who checked and when. This audit trail is the reason the company moved off Salesforce to a custom build.",
    fields: ["lot", "check item", "result", "checked by", "checked at"], links: ["lots", "orders", "holds"] },
  { id: "holds", name: "Holds", stage: "released", kind: "table",
    why: "Stops a lot or shipment until an issue is cleared, with the reason on record.",
    fields: ["lot or shipment", "reason", "placed / released"], links: ["release_checks", "shipments"] },
  { id: "lab_tests", name: "Lab tests", stage: "released", kind: "table",
    why: "Nutritional and microbial test results by lot.",
    fields: ["lot", "test", "result", "date"], links: ["lots"] },

  // Packed and shipped
  { id: "shipments", name: "Shipments", stage: "shipped", kind: "table",
    why: "Outbound packages per order, with tracking numbers. The tracking number is what carrier invoices are matched on.",
    fields: ["order", "carrier", "tracking number", "shipped at", "zone"], links: ["orders", "carrier_invoices", "holds"] },
  { id: "inventory_items", name: "Inventory items", stage: "shipped", kind: "table", role: "built",
    why: "Packaging and supplies: pouches, labels, boxes, cooler packs. Each item knows how many pieces come in a package, so people can count the way they buy.",
    fields: ["item", "category", "unit", "pieces per package", "reorder point"], links: ["inventory_movements", "inventory_purchases", "products"] },
  { id: "inventory_movements", name: "Inventory movements", stage: "shipped", kind: "table", role: "built",
    why: "Every count, receipt and use is a row, entered in individual pieces. On-hand is always the sum of movements, so any number can be explained line by line instead of being overwritten.",
    fields: ["item", "type (count / receipt / use)", "pieces", "at", "by"], links: ["inventory_items", "inventory_purchases"] },
  { id: "inventory_purchases", name: "Purchases and vendors", stage: "shipped", kind: "table", role: "built",
    why: "Purchase orders and the vendors they go to, so reorders and lead times are on record.",
    fields: ["vendor", "item", "quantity", "ordered / received"], links: ["inventory_items", "inventory_movements"] },

  // Costed
  { id: "carrier_invoices", name: "Carrier invoices", stage: "costed", kind: "table", role: "built",
    why: "Carrier invoice PDFs are imported line by line and matched to orders by tracking number, so each order carries its true shipping cost. Pickup fees are split across the orders a pickup served. Lines that don't match are flagged for a person to review.",
    fields: ["invoice", "line", "tracking number", "charge", "matched order", "needs attention"], links: ["shipments", "orders", "store_financials"] },
  { id: "store_financials", name: "Store order financials", stage: "costed", kind: "table", role: "built",
    why: "The online store's totals for each order (subtotal, discounts, shipping charged, tax). Set against the true shipping cost, they give average order value and shipping margin by month.",
    fields: ["order", "subtotal", "discounts", "shipping charged", "tax", "total"], links: ["orders", "carrier_invoices"] },
];

/** All connections, both directions. */
export function relatedTo(id: string): string[] {
  const o = OBJECTS.find((x) => x.id === id);
  const out = new Set<string>(o?.links ?? []);
  for (const x of OBJECTS) if (x.links.includes(id)) out.add(x.id);
  out.delete(id);
  return [...out];
}

export const BUILD_STORY = [
  { step: "Architected", text: "I architected the company's Salesforce org: the order model, orders flowing in from the online store, and status emails to customers as an order moves. Then I gathered the requirements for the next big pieces, machine and cooler tracking." },
  { step: "Foundation", text: "The company needed a full audit trail for cGMP certification and moved to a custom build. Its quality consultant chose the stack and built the ERP's foundation from that architecture, including cooler and machine tracking." },
  { step: "Designed with Marcus", text: "I specified what the lab time tracker had to do for workers on the floor and for operations, from my time in Amazon fulfillment centers. Marcus Hansen worked out how to build it: the scan app, worker sign-in and QR stickers." },
  { step: "Planned and built", text: "I planned and built inventory, carrier invoice costing, store order financials for average order value, and the compliance model, alerts and digest on top of the time tracker." },
];
