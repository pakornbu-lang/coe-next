"use client";

import { useState } from "react";

function normalize(value: string | number | undefined) {
  const input = String(value ?? "").replace(/,/g, "").replace(/[^0-9.]/g, "");
  const [integer = "", ...decimals] = input.split(".");
  return `${integer.replace(/^0+(?=\d)/, "")}${decimals.length ? `.${decimals.join("").slice(0, 2)}` : ""}`;
}

function display(value: string) {
  const [integer = "", decimal] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal === undefined ? grouped : `${grouped}.${decimal}`;
}

export default function MoneyInput({
  name,
  defaultValue,
  required = false,
  min,
  maxLength = 30,
  id,
  ariaDescribedby,
}: {
  name: string;
  defaultValue?: string | number | null;
  required?: boolean;
  min?: number;
  maxLength?: number;
  id?: string;
  ariaDescribedby?: string;
}) {
  const [raw, setRaw] = useState(() => normalize(defaultValue ?? ""));
  return <>
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      required={required}
      minLength={min ? 1 : undefined}
      maxLength={maxLength + Math.floor(maxLength / 3)}
      value={display(raw)}
      aria-describedby={ariaDescribedby}
      onChange={(event) => setRaw(normalize(event.target.value))}
    />
    <input type="hidden" name={name} value={raw} />
  </>;
}
