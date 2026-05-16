export type CapitalTransactionType = "INJECTION" | "WITHDRAWAL";

export type CapitalCategory =
  | "INITIAL_CAPITAL"
  | "ADDITIONAL_CAPITAL"
  | "CAPITAL_ADJUSTMENT_IN"
  | "OWNER_DRAW"
  | "CASH_ADJUSTMENT_OUT";

export const CAPITAL_CATEGORY_META: Record<
  CapitalCategory,
  { label: string; prefix: string; type: CapitalTransactionType; description: string }
> = {
  INITIAL_CAPITAL: {
    label: "Modal awal",
    prefix: "MODAL_AWAL",
    type: "INJECTION",
    description: "Setoran modal pembuka usaha.",
  },
  ADDITIONAL_CAPITAL: {
    label: "Tambahan modal",
    prefix: "TAMBAHAN_MODAL",
    type: "INJECTION",
    description: "Setoran modal tambahan setelah usaha berjalan.",
  },
  CAPITAL_ADJUSTMENT_IN: {
    label: "Penyesuaian modal masuk",
    prefix: "PENYESUAIAN_MODAL_MASUK",
    type: "INJECTION",
    description: "Koreksi kas/modal masuk yang bukan modal awal.",
  },
  OWNER_DRAW: {
    label: "Prive",
    prefix: "PRIVE",
    type: "WITHDRAWAL",
    description: "Penarikan kas oleh pemilik.",
  },
  CASH_ADJUSTMENT_OUT: {
    label: "Penyesuaian kas keluar",
    prefix: "PENYESUAIAN_KAS_KELUAR",
    type: "WITHDRAWAL",
    description: "Koreksi kas keluar yang bukan prive.",
  },
};

const PREFIX_PATTERN = /^\[(MODAL_AWAL|TAMBAHAN_MODAL|PENYESUAIAN_MODAL_MASUK|PRIVE|PENYESUAIAN_KAS_KELUAR)\]\s*/;

export function getCapitalCategoryOptions(type: CapitalTransactionType) {
  return Object.entries(CAPITAL_CATEGORY_META)
    .filter(([, meta]) => meta.type === type)
    .map(([value, meta]) => ({ value: value as CapitalCategory, ...meta }));
}

export function classifyCapitalTransaction(type: CapitalTransactionType, notes: string | null | undefined): CapitalCategory {
  const rawNotes = notes ?? "";
  const explicitPrefix = rawNotes.match(PREFIX_PATTERN)?.[1];
  const explicitCategory = Object.entries(CAPITAL_CATEGORY_META).find(([, meta]) => meta.prefix === explicitPrefix)?.[0] as
    | CapitalCategory
    | undefined;

  if (explicitCategory && CAPITAL_CATEGORY_META[explicitCategory].type === type) {
    return explicitCategory;
  }

  const normalizedNotes = rawNotes.toLowerCase();
  if (type === "INJECTION") {
    if (normalizedNotes.includes("modal awal")) {
      return "INITIAL_CAPITAL";
    }

    return "ADDITIONAL_CAPITAL";
  }

  if (normalizedNotes.includes("penyesuaian") || normalizedNotes.includes("koreksi")) {
    return "CASH_ADJUSTMENT_OUT";
  }

  return "OWNER_DRAW";
}

export function stripCapitalCategoryPrefix(notes: string | null | undefined): string {
  return (notes ?? "").replace(PREFIX_PATTERN, "");
}

export function applyCapitalCategoryToNotes(notes: string | null | undefined, category: CapitalCategory): string {
  const cleanNotes = stripCapitalCategoryPrefix(notes).trim();
  const prefix = CAPITAL_CATEGORY_META[category].prefix;

  return cleanNotes ? `[${prefix}] ${cleanNotes}` : `[${prefix}]`;
}
