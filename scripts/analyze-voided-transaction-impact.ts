import 'dotenv/config';
import prisma from '../src/lib/db';

type Args = {
  storeId?: string;
  startDate: Date;
  endDate: Date;
};

type NumericRow = Record<string, number | string | bigint | null>;

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const parsed: Args = { startDate, endDate };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (arg === '--store-id' && value) {
      parsed.storeId = value;
      index += 1;
    } else if (arg === '--start-date' && value) {
      parsed.startDate = parseLocalDate(value, false);
      index += 1;
    } else if (arg === '--end-date' && value) {
      parsed.endDate = parseLocalDate(value, true);
      index += 1;
    } else if (arg === '--today') {
      parsed.startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      parsed.endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    }
  }

  return parsed;
}

function parseLocalDate(value: string, endOfDay: boolean): Date {
  if (value.includes('T')) {
    return new Date(value);
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
}

function toNumber(value: number | string | bigint | null | undefined): number {
  return Number(value ?? 0);
}

function format(value: number): string {
  return currency.format(Math.round(value));
}

async function main() {
  const args = parseArgs();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');

    const stores = await tx.store.findMany({
      where: args.storeId ? { id: args.storeId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    console.log('READ ONLY audit: dampak transaksi VOIDED pada laporan.');
    console.log(`Periode: ${args.startDate.toISOString()} s/d ${args.endDate.toISOString()}`);
    console.log(`Store: ${args.storeId || 'semua store'}\n`);

    if (stores.length === 0) {
      console.log('Tidak ada store yang cocok.');
      return;
    }

    for (const store of stores) {
      const [
        periodAll,
        periodCompleted,
        periodVoided,
        periodAllCogsRows,
        periodCompletedCogsRows,
        allTimeCashAll,
        allTimeCashCompleted,
        allTimeDebtAll,
        allTimeDebtCompleted,
      ] = await Promise.all([
        tx.transaction.aggregate({
          where: {
            storeId: store.id,
            createdAt: { gte: args.startDate, lte: args.endDate },
          },
          _count: { _all: true },
          _sum: { total: true, amountPaid: true, discount: true },
        }),
        tx.transaction.aggregate({
          where: {
            storeId: store.id,
            status: 'COMPLETED',
            createdAt: { gte: args.startDate, lte: args.endDate },
          },
          _count: { _all: true },
          _sum: { total: true, amountPaid: true, discount: true },
        }),
        tx.transaction.aggregate({
          where: {
            storeId: store.id,
            status: 'VOIDED',
            createdAt: { gte: args.startDate, lte: args.endDate },
          },
          _count: { _all: true },
          _sum: { total: true, amountPaid: true, discount: true },
        }),
        tx.$queryRaw<NumericRow[]>`
          SELECT COALESCE(SUM(COALESCE(ti.cost_price, ti.price * 0.7) * ti.quantity), 0) AS value
          FROM "transaction_items" ti
          INNER JOIN "transactions" t ON t.id = ti.transaction_id
          WHERE t.store_id = ${store.id}
            AND t.created_at >= ${args.startDate}
            AND t.created_at <= ${args.endDate}
        `,
        tx.$queryRaw<NumericRow[]>`
          SELECT COALESCE(SUM(COALESCE(ti.cost_price, ti.price * 0.7) * ti.quantity), 0) AS value
          FROM "transaction_items" ti
          INNER JOIN "transactions" t ON t.id = ti.transaction_id
          WHERE t.store_id = ${store.id}
            AND t.status = 'COMPLETED'
            AND t.created_at >= ${args.startDate}
            AND t.created_at <= ${args.endDate}
        `,
        tx.transaction.aggregate({
          where: { storeId: store.id },
          _sum: { amountPaid: true },
        }),
        tx.transaction.aggregate({
          where: { storeId: store.id, status: 'COMPLETED' },
          _sum: { amountPaid: true },
        }),
        tx.debtPayment.aggregate({
          where: { transaction: { storeId: store.id } },
          _sum: { amount: true },
        }),
        tx.debtPayment.aggregate({
          where: { transaction: { storeId: store.id, status: 'COMPLETED' } },
          _sum: { amount: true },
        }),
      ]);

      const periodAllRevenue = periodAll._sum.total ?? 0;
      const periodCompletedRevenue = periodCompleted._sum.total ?? 0;
      const periodAllCogs = toNumber(periodAllCogsRows[0]?.value);
      const periodCompletedCogs = toNumber(periodCompletedCogsRows[0]?.value);
      const cashAll = (allTimeCashAll._sum.amountPaid ?? 0) + (allTimeDebtAll._sum.amount ?? 0);
      const cashCompleted = (allTimeCashCompleted._sum.amountPaid ?? 0) + (allTimeDebtCompleted._sum.amount ?? 0);

      console.log(`== ${store.name} (${store.id}) ==`);
      console.log(`Transaksi periode semua status: ${periodAll._count._all}`);
      console.log(`Transaksi periode COMPLETED: ${periodCompleted._count._all}`);
      console.log(`Transaksi periode VOIDED: ${periodVoided._count._all}`);
      console.log(`Revenue laporan lama: ${format(periodAllRevenue)}`);
      console.log(`Revenue setelah exclude VOIDED: ${format(periodCompletedRevenue)}`);
      console.log(`Selisih revenue VOIDED: ${format(periodAllRevenue - periodCompletedRevenue)}`);
      console.log(`COGS laporan lama: ${format(periodAllCogs)}`);
      console.log(`COGS setelah exclude VOIDED: ${format(periodCompletedCogs)}`);
      console.log(`Selisih gross profit: ${format((periodAllRevenue - periodAllCogs) - (periodCompletedRevenue - periodCompletedCogs))}`);
      console.log(`Kas masuk all-time lama: ${format(cashAll)}`);
      console.log(`Kas masuk all-time setelah exclude VOIDED: ${format(cashCompleted)}`);
      console.log(`Selisih kas karena transaksi VOIDED/debt payment VOIDED: ${format(cashAll - cashCompleted)}\n`);
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
