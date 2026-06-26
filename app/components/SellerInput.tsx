"use client";

/** Seller offerings offered as one-tap quick-fill chips. */
const SELLER_EXAMPLES = [
  "PBM consulting",
  "Pharmacy consulting",
  "Packaging / banding equipment",
  "Commercial insurance",
  "Executive recruiting",
  "Accounting / advisory",
  "IT consulting",
  "Marketing services",
  "Legal services",
];

interface SellerInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function SellerInput({ value, onChange }: SellerInputProps) {
  return (
    <div>
      <label htmlFor="seller-input" className="label-mono">
        What you sell
      </label>
      <input
        id="seller-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. PBM consulting"
        className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-foreground placeholder:text-muted-2 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SELLER_EXAMPLES.map((example) => {
          const active = value.trim().toLowerCase() === example.toLowerCase();
          return (
            <button
              key={example}
              type="button"
              onClick={() => onChange(example)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              {example}
            </button>
          );
        })}
      </div>
    </div>
  );
}
