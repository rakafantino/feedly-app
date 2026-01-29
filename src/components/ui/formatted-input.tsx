'use client';

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (value: string) => void;
  thousandSeparator?: string;
  allowEmpty?: boolean;
}

const FormattedNumberInput = React.forwardRef<HTMLInputElement, FormattedNumberInputProps>(
  (
    {
      className,
      value,
      onChange,
      thousandSeparator = '.',
      allowEmpty = true,
      ...props
    },
    ref
  ) => {
    // Track jika input dalam keadaan fokus
    const [isFocused, setIsFocused] = React.useState(false);

    // Track cursor based on digits count strictly
    const inputRef = React.useRef<HTMLInputElement>(null);
    // We store the number of digits that were to the left of the cursor
    const [digitsBeforeCursor, setDigitsBeforeCursor] = React.useState<number | null>(null);

    // Gabungkan refs
    const handleRef = (element: HTMLInputElement | null) => {
      inputRef.current = element;
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    // Format nilai untuk tampilan
    const formatValue = (val: string | number): string => {
      if (val === '' || val === null || val === undefined) return '';

      // Memastikan nilai adalah string
      const strValue = String(val);

      // Menghapus semua karakter non-digit
      const digits = strValue.replace(/\D/g, '');

      // Jika tidak ada digit, kembalikan string kosong
      if (!digits) return '';

      // Format dengan pemisah ribuan
      return digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
    };

    // Mendapatkan nilai numerik dari format string
    const getNumericValue = (val: string): string => {
      // Menghapus semua karakter non-digit
      return val.replace(/\D/g, '');
    };

    // Menampilkan nilai yang diformat
    const displayValue = isFocused && value === '' ? '' : formatValue(value);

    // Handler untuk mengubah nilai
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const selectionStart = e.target.selectionStart || 0;

      // Calculate how many digits were before the cursor
      // This is the robust metric that survives formatting changes
      const valueBeforeCursor = inputValue.slice(0, selectionStart);
      const digitsCount = valueBeforeCursor.replace(/\D/g, '').length;
      
      setDigitsBeforeCursor(digitsCount);

      // Jika input kosong dan allowEmpty true, kirim string kosong
      if (inputValue === '' && allowEmpty) {
        onChange('');
        return;
      }

      const numericValue = getNumericValue(inputValue);
      onChange(numericValue);
    };

    // Use useLayoutEffect to update cursor position synchronously after render
    // preventing visible jumps
    React.useLayoutEffect(() => {
      if (digitsBeforeCursor !== null && inputRef.current && isFocused) {
        const currentDisplayValue = inputRef.current.value; // Should match displayValue
        
        // Find the new position where we have passed 'digitsBeforeCursor' digits
        let newPos = 0;
        let digitsSeen = 0;
        
        for (let i = 0; i < currentDisplayValue.length; i++) {
          if (/\d/.test(currentDisplayValue[i])) {
            digitsSeen++;
          }
           // Check if we reached the target. 
           // If digitsBeforeCursor is 0, we perform 0 loops or break immediately?
           // If digitsBeforeCursor is 0, loop starts, digitsSeen is 0.
           
           if (digitsSeen === digitsBeforeCursor) {
              // We have seen enough digits.
              // The cursor should be AFTER this character.
              // IF digitsBeforeCursor was 0, we want position 0.
              // IF digitsBeforeCursor was 1, we found 1 digit at index i.
              // We want cursor at i + 1.
              newPos = i + 1;
           } else if (digitsSeen > digitsBeforeCursor){
               // Should not happen if logic is correct but break to be safe
               break;
           }
        }
        
        // Special case: if digitsBeforeCursor is 0, newPos should be 0.
        // My loop logic:
        // i=0. Digit? Yes. digitsSeen=1. If target=1 => newPos = 1. Correct.
        // What if target is 0? Loop i=0. digitsSeen=1. digitsSeen > target.
        // So newPos remains 0. Correct.
        
        // One edge case: If the cursor was at the very end, and we added a thousand separator?
        // 123| -> type 4 -> 1234. Digits=4.
        // Display: 1.234
        // i=0(1) seen=1. i=1(.) no. i=2(2) seen=2. i=3(3) seen=3. i=4(4) seen=4. target reached. newPos=5.
        // Correct.
        
        // Another edge case: 1.|234 (cursor after dot). Digits before = 1.
        // Type 5. 1.5|234.
        // Input value would involve inserted char.
        // But what if we just click/move cursor? 
        // Oh, handleChange only fires on INPUT.
        // If I click, handleChange doesn't fire, digitsBeforeCursor doesn't update.
        // So existing cursor position is preserved? NO. `digitsBeforeCursor` is state.
        // If I click, state is stale?
        // We need to reset `digitsBeforeCursor` on Blur or some other event?
        // Or strictly strictly only apply this effect when `digitsBeforeCursor` changes?
        // Currently depend on [displayValue, digitsBeforeCursor, isFocused].
        // If I just click, displayValue doesn't change. Effect doesn't run. Safe.
        
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, [displayValue, digitsBeforeCursor, isFocused]);

    return (
      <Input
        type="text"
        className={cn("text-right", className)}
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
            setIsFocused(false);
            setDigitsBeforeCursor(null); // Reset
        }}
        inputMode="numeric"
        ref={handleRef}
        {...props}
      />
    );
  }
);
FormattedNumberInput.displayName = "FormattedNumberInput";
export { FormattedNumberInput }; 