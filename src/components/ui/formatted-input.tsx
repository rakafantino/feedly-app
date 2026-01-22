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

    // Track cursor position
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [cursorPosition, setCursorPosition] = React.useState<number | null>(null);

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
      const curPos = e.target.selectionStart;

      // Jika input kosong dan allowEmpty true, kirim string kosong
      if (inputValue === '' && allowEmpty) {
        onChange('');
        setCursorPosition(0);
        return;
      }

      const numericValue = getNumericValue(inputValue);
      onChange(numericValue);

      // Simpan posisi kursor untuk disetel ulang setelah re-render
      setCursorPosition(curPos);
    };

    // Restore cursor position setelah format angka berubah
    React.useEffect(() => {
      if (cursorPosition !== null && inputRef.current && isFocused) {
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, [displayValue, cursorPosition, isFocused]);

    return (
      <Input
        type="text"
        className={cn("text-right", className)}
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        inputMode="numeric"
        ref={handleRef}
        {...props}
      />
    );
  }
);

FormattedNumberInput.displayName = "FormattedNumberInput";

export { FormattedNumberInput }; 