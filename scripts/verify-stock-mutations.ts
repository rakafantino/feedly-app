/**
 * Verify Stock Mutation Centralization (static code check, READ-ONLY)
 *
 * Ensures no code outside StockMutationService mutates stock using the raw
 * Prisma `{ increment }` / `{ decrement }` operators, which bypass the dust
 * sanitization layer.
 *
 * Run: npx tsx scripts/verify-stock-mutations.ts
 * Exits with code 1 if any violation is found.
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// Files allowed to perform low-level stock writes.
const ALLOWLIST = [
  "src/services/stock-mutation.service.ts",
];

// Pattern: stock: { increment: ... } or stock: { decrement: ... }
const VIOLATION_PATTERN = /stock:\s*\{\s*(increment|decrement)/;

function listTsFiles(): string[] {
  const output = execSync(`find "${SRC}" -type f \\( -name "*.ts" -o -name "*.tsx" \\)`, {
    encoding: "utf-8",
  });
  return output.split("\n").filter(Boolean);
}

function main() {
  const files = listTsFiles();
  const violations: { file: string; line: number; text: string }[] = [];

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (ALLOWLIST.includes(rel)) continue;
    if (rel.includes(".test.")) continue;

    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (VIOLATION_PATTERN.test(line)) {
        violations.push({ file: rel, line: idx + 1, text: line.trim() });
      }
    });
  }

  console.log("=".repeat(70));
  console.log("STOCK MUTATION CENTRALIZATION CHECK");
  console.log("=".repeat(70));
  console.log(`Scanned ${files.length} files.`);
  console.log(`Allowlisted: ${ALLOWLIST.join(", ")}`);
  console.log();

  if (violations.length === 0) {
    console.log("✅ No direct stock increment/decrement mutations found outside StockMutationService.");
    process.exit(0);
  }

  console.log(`❌ Found ${violations.length} violation(s):`);
  for (const v of violations) {
    console.log(`  - ${v.file}:${v.line}  ${v.text}`);
  }
  console.log();
  console.log("Use StockMutationService (increment/deduct/createBatch) instead.");
  process.exit(1);
}

main();
