import { Minus, Plus } from "lucide-react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export function QuantityInput({ value, onChange, min = 1, max = 100000, label }: Props) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="inline-flex items-stretch border border-line" role="group" aria-label={label ?? "Количество"}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-fog disabled:opacity-40"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Уменьшить количество"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        aria-label={label ?? "Количество"}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (Number.isFinite(v)) onChange(clamp(v));
        }}
        className="h-11 w-16 border-x border-line text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-fog disabled:opacity-40"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Увеличить количество"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
