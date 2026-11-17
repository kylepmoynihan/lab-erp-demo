// Data model of the full ERP, generalized from the production system.
// Table and field names are simplified; nothing here is customer data.

export type Credit = "kyle" | "kyle-marcus" | undefined;

export type Obj = {
  id: string;
  name: string;
  area: string;
  purpose: string;
  fields: string[];
  links: string[]; // ids of related objects
  credit?: Credit;
  live?: string; // path to a working page in this demo
};

export const AREAS = [
  { id: "sales", name: "Customers & orders" },
  { id: "intake", name: "Intake & cold chain" },
  { id: "production", name: "Production" },
  { id: "lab", name: "Lab time tracking" },
  { id: "quality", name: "Quality records" },
  { id: "ship", name: "Shipping & finance" },
  { id: "inventory", name: "Inventory" },
];

export const OBJECTS: Obj[] = [
  // Customers & orders
  { id: "customers", name: "Customers", area: "sales", purpose: "Each parent who sends milk in.", fields: ["name", "email", "phone", "default address", "order history"], links: ["addresses", "orders"] },
  { id: "addresses", name: "Addresses", area: "sales", purpose: "Shipping addresses, reused across orders.", fields: ["street", "city", "state", "zip", "shipping zone"], links: ["customers", "orders"] },
  { id: "orders", name: "Orders", area: "sales", purpose: "The center of the system. One order follows one customer's milk from cooler to shipment.", fields: ["order number", "store order number", "ordered oz", "received oz", "actual oz", "status", "order type (shipped or local)", "received / shipped dates", "special instructions"], links: ["customers", "addresses", "line_items", "status_workflow", "coolers", "receipts", "cut_bags", "lots", "shipments", "store_financials", "time_entries", "release_checks"] },
  { id: "line_items", name: "Order line items", area: "sales", purpose: "What the customer bought: pouch sizes, add-ons, services.", fields: ["product", "quantity", "price"], links: ["orders", "products"] },
  { id: "products", name: "Products", area: "sales", purpose: "Catalog of pouch formats and services.", fields: ["SKU", "name", "oz per unit", "price"], links: ["line_items", "inventory_items"] },
  { id: "status_workflow", name: "Status workflow", area: "sales", purpose: "Ordered list of order statuses. Checkpoints and reports compare by sort order.", fields: ["code", "label", "sort order"], links: ["orders"] },

  // Intake & cold chain
  { id: "coolers", name: "Coolers", area: "intake", purpose: "Insulated shipping coolers sent to customers and returned full. Tracked so none get lost and every order can be traced to its cooler.", fields: ["cooler ID", "size", "condition", "current location", "last order"], links: ["orders", "cooler_status"] },
  { id: "cooler_status", name: "Cooler status", area: "intake", purpose: "Where every cooler is right now: at the lab, out to a customer, in transit back.", fields: ["cooler", "status", "since", "tracking number"], links: ["coolers"] },
  { id: "receipts", name: "Receipts & weight checks", area: "intake", purpose: "Milk received at the lab: weight at receipt, temperature, and disposition.", fields: ["order", "received at", "weight oz", "temperature °F", "disposition"], links: ["orders", "freezer_storage"] },
  { id: "freezer_storage", name: "Freezer storage", area: "intake", purpose: "Which freezer holds each order's milk before processing, with temperature readings.", fields: ["freezer", "order", "in / out", "readings"], links: ["receipts"] },

  // Production
  { id: "cut_bags", name: "Cut bags", area: "production", purpose: "Weights keyed live at the cutting station. Also the evidence the lab tracker uses to catch missed scans.", fields: ["order", "bag weight", "keyed at"], links: ["orders", "time_entries"] },
  { id: "lots", name: "Lots", area: "production", purpose: "A freeze-drying batch. Ties orders to a machine and a cycle for traceability.", fields: ["lot number", "machine", "cycle start / end", "orders"], links: ["orders", "freeze_dryers", "dryer_cycles", "release_checks"] },
  { id: "freeze_dryers", name: "Freeze dryers", area: "production", purpose: "Every machine, its size and its service history.", fields: ["machine ID", "type / size", "status", "serviceability log"], links: ["lots", "dryer_cycles", "dryer_queue"] },
  { id: "dryer_cycles", name: "Dryer cycles", area: "production", purpose: "Each run of a machine: load, start, end, unload.", fields: ["machine", "lot", "loaded at", "unloaded at"], links: ["freeze_dryers", "lots"] },
  { id: "dryer_queue", name: "Dryer queue", area: "production", purpose: "Planning board: which orders go into which machine next.", fields: ["machine", "position", "orders", "planned start"], links: ["freeze_dryers", "orders"] },

  // Lab time tracking
  { id: "stations", name: "Stations", area: "lab", purpose: "Each work area, with a QR sticker.", fields: ["code", "name (EN / ES)", "active"], links: ["tasks"], credit: "kyle-marcus", live: "/admin/stations/" },
  { id: "tasks", name: "Tasks", area: "lab", purpose: "Work done at a station, how it is measured, and whether it is a mandatory checkpoint.", fields: ["station", "code", "name (EN / ES)", "measure", "checkpoint gate"], links: ["stations", "time_entries"], credit: "kyle-marcus", live: "/admin/stations/" },
  { id: "workers", name: "Lab workers", area: "lab", purpose: "Roster, allowed stations, linked login.", fields: ["name", "allowed stations", "active"], links: ["time_entries"], credit: "kyle-marcus" },
  { id: "time_entries", name: "Time entries", area: "lab", purpose: "One scan-in to scan-out on a task, linked to one or more orders.", fields: ["worker", "task", "started / ended", "paused minutes", "orders", "machine", "lot", "team partners", "auto-closed"], links: ["workers", "tasks", "orders", "cut_bags", "lab_alerts"], credit: "kyle-marcus", live: "/admin/log/" },
  { id: "lab_alerts", name: "Tracking alerts", area: "lab", purpose: "Missed-scan ledger, detected from production evidence, reported in a twice-daily digest.", fields: ["order", "task", "rule", "detected at", "reported at", "resolved / addressed"], links: ["time_entries", "orders"], credit: "kyle", live: "/admin/alerts/" },

  // Quality
  { id: "release_checks", name: "Release checks", area: "quality", purpose: "Checks a lot must pass before it ships. Part of the audit trail the move off Salesforce was for.", fields: ["lot", "check item", "result", "checked by", "checked at"], links: ["lots", "orders", "holds"] },
  { id: "holds", name: "Holds", area: "quality", purpose: "Stops a lot or shipment until an issue is cleared.", fields: ["lot or shipment", "reason", "placed / released"], links: ["release_checks", "shipments"] },
  { id: "lab_tests", name: "Lab tests", area: "quality", purpose: "Nutritional and microbial test results by lot.", fields: ["lot", "test", "result", "date"], links: ["lots"] },

  // Shipping & finance
  { id: "shipments", name: "Shipments", area: "ship", purpose: "Outbound packages per order, with tracking.", fields: ["order", "carrier", "tracking number", "shipped at", "zone"], links: ["orders", "carrier_invoices"] },
  { id: "carrier_invoices", name: "Carrier invoices", area: "ship", purpose: "Carrier invoice PDFs imported line by line and matched to orders, so each order carries its true shipping cost. Pickup fees are split across the orders a pickup served.", fields: ["invoice", "line", "tracking number", "charge", "matched order", "needs attention"], links: ["shipments", "orders", "store_financials"], credit: "kyle" },
  { id: "store_financials", name: "Store order financials", area: "ship", purpose: "Order totals captured from the online store, for true average order value and shipping margin by month.", fields: ["order", "subtotal", "discounts", "shipping charged", "tax", "total"], links: ["orders", "carrier_invoices"], credit: "kyle" },

  // Inventory
  { id: "inventory_items", name: "Inventory items", area: "inventory", purpose: "Packaging and supplies: pouches, labels, boxes, cooler packs.", fields: ["item", "category", "unit", "pieces per package", "reorder point"], links: ["inventory_movements", "inventory_purchases", "products"] },
  { id: "inventory_movements", name: "Inventory movements", area: "inventory", purpose: "Every count, receipt and use, entered in individual pieces so on-hand is always a sum of movements.", fields: ["item", "type (count / receipt / use)", "pieces", "at", "by"], links: ["inventory_items"], credit: "kyle" },
  { id: "inventory_purchases", name: "Purchases & vendors", area: "inventory", purpose: "Purchase orders and the vendors they go to.", fields: ["vendor", "item", "quantity", "ordered / received"], links: ["inventory_items"] },
];

export const FLOW = [
  { step: "Cooler shipped", obj: "coolers" },
  { step: "Milk received & weighed", obj: "receipts" },
  { step: "Cut", obj: "cut_bags" },
  { step: "Processed", obj: "time_entries" },
  { step: "Loaded into a machine", obj: "lots" },
  { step: "Released", obj: "release_checks" },
  { step: "Packed & labeled", obj: "time_entries" },
  { step: "Shipped", obj: "shipments" },
  { step: "Costed", obj: "carrier_invoices" },
];
