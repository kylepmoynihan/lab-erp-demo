"use client";
import { RANGE_LABELS, type RangeKey } from "@/lib/time";

export default function RangePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="seg" role="group" aria-label="Date range">
      {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
        <button key={k} className={k === value ? "on" : ""} onClick={() => onChange(k)}>
          {RANGE_LABELS[k]}
        </button>
      ))}
    </div>
  );
}
