"use client";

import type { InputHTMLAttributes } from "react";

type DigitsInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "inputMode" | "type">;

/** A text input that strips every character except 0–9, including pasted text. */
export default function DigitsInput({ defaultValue, maxLength, onInput, ...props }: DigitsInputProps) {
  const clean = (raw: string) => raw.replace(/\D/g, "").slice(0, maxLength);
  const initialValue = defaultValue === undefined ? undefined : clean(String(defaultValue));

  return <input
    {...props}
    type="text"
    inputMode="numeric"
    autoComplete="off"
    maxLength={maxLength}
    pattern="[0-9]*"
    defaultValue={initialValue}
    onInput={(event) => {
      const input = event.currentTarget;
      const next = clean(input.value);
      if (input.value !== next) input.value = next;
      onInput?.(event);
    }}
  />;
}
