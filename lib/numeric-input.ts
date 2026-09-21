import type { InputHTMLAttributes } from "react";

type NumericMode = "integer" | "decimal" | "phone";

/** Keep native validation and editing shortcuts while blocking non-numeric input. */
export function numericInputProps(mode: NumericMode = "integer"): InputHTMLAttributes<HTMLInputElement> {
  const allowed = mode === "decimal" ? /^[0-9.]*$/ : mode === "phone" ? /^[0-9+ ()-]*$/ : /^[0-9]*$/;
  const reject = (text: string) => !allowed.test(text);
  return {
    inputMode: mode === "decimal" ? "decimal" : mode === "phone" ? "tel" : "numeric",
    onKeyDown(event) {
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && reject(event.key)) event.preventDefault();
    },
    onBeforeInput(event) {
      const data = (event.nativeEvent as InputEvent).data;
      if (data && reject(data)) event.preventDefault();
    },
    onPaste(event) {
      if (reject(event.clipboardData.getData("text"))) event.preventDefault();
    },
    onDrop(event) {
      if (reject(event.dataTransfer.getData("text"))) event.preventDefault();
    },
    onInput(event) {
      // Fallback for input methods/autofill without cancellable keyboard events.
      const input = event.currentTarget;
      if (reject(input.value)) {
        input.value = input.value.replace(mode === "decimal" ? /[^0-9.]/g : mode === "phone" ? /[^0-9+ ()-]/g : /[^0-9]/g, "");
      }
    },
  };
}
