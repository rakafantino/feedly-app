import prisma from '../src/lib/prisma';

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) {
    console.error('No store found');
    return;
  }
  const storeId = store.id;

  console.log(`Tracing Cash Balance for Store: ${store.name} (${storeId})\n`);

  // 1. Transactions (amountPaid)
  const allTransactions = await prisma.transaction.aggregate({
    where: { storeId },
    _sum: { amountPaid: true }
  });
  const txAmount = allTransactions._sum.amountPaid || 0;
  console.log(`[+] Uang Masuk dari Penjualan (Transaction.amountPaid): Rp ${txAmount.toLocaleString('id-ID')}`);

  // 2. Debt Payments (amount)
  const allDebtPayments = await prisma.debtPayment.aggregate({
    where: { transaction: { storeId } },
    _sum: { amount: true }
  });
  const debtAmount = allDebtPayments._sum.amount || 0;
  console.log(`[+] Uang Masuk dari Cicilan Pelanggan (DebtPayment.amount): Rp ${debtAmount.toLocaleString('id-ID')}`);

  // 3. Capital Injections
  const capitalInjections = await prisma.capitalTransaction.aggregate({
    where: { storeId, type: 'INJECTION' },
    _sum: { amount: true }
  });
  const capInAmount = capitalInjections._sum.amount || 0;
  console.log(`[+] Uang Masuk dari Modal (CapitalTransaction INJECTION): Rp ${capInAmount.toLocaleString('id-ID')}`);

  const totalCashIn = txAmount + debtAmount + capInAmount;
  console.log(`--------------------------------------------------`);
  console.log(`TOTAL UANG MASUK: Rp ${totalCashIn.toLocaleString('id-ID')}\n`);

  // 4. Purchase Orders (amountPaid)
  const allPurchaseOrders = await prisma.purchaseOrder.aggregate({
    where: { storeId },
    _sum: { amountPaid: true }
  });
  const poAmount = allPurchaseOrders._sum.amountPaid || 0;
  console.log(`[-] Uang Keluar untuk PO (PurchaseOrder.amountPaid): Rp ${poAmount.toLocaleString('id-ID')}`);

  // 5. Expenses (amount)
  const allExpenses = await prisma.expense.aggregate({
    where: { storeId },
    _sum: { amount: true }
  });
  const expAmount = allExpenses._sum.amount || 0;
  console.log(`[-] Uang Keluar untuk Biaya Operasional (Expense.amount): Rp ${expAmount.toLocaleString('id-ID')}`);

  // 6. Capital Withdrawals
  const capitalWithdrawals = await prisma.capitalTransaction.aggregate({
    where: { storeId, type: 'WITHDRAWAL' },
    _sum: { amount: true }
  });
  const capOutAmount = capitalWithdrawals._sum.amount || 0;
  console.log(`[-] Uang Keluar untuk Penarikan Modal (CapitalTransaction WITHDRAWAL): Rp ${capOutAmount.toLocaleString('id-ID')}`);

  const totalCashOut = poAmount + expAmount + capOutAmount;
  console.log(`--------------------------------------------------`);
  console.log(`TOTAL UANG KELUAR: Rp ${totalCashOut.toLocaleString('id-ID')}\n`);

  const currentCashBalance = totalCashIn - totalCashOut;
  console.log(`==================================================`);
  console.log(`SALDO KAS AKTUAL (Masuk - Keluar): Rp ${currentCashBalance.toLocaleString('id-ID')}`);
  console.log(`==================================================\n`);

  // Let's also list the POs and Expenses to see if there's any anomaly
  console.log('--- Rincian PO yang sudah dibayar ---');
  const pos = await prisma.purchaseOrder.findMany({
    where: { storeId, amountPaid: { gt: 0 } },
    select: { poNumber: true, amountPaid: true, totalAmount: true }
  });
  pos.forEach(po => console.log(`  ${po.poNumber}: Rp ${po.amountPaid.toLocaleString('id-ID')} (Total: Rp ${po.totalAmount.toLocaleString('id-ID')})`));

  console.log('\n--- Rincian Biaya Operasional ---');
  const exps = await prisma.expense.findMany({
    where: { storeId },
    select: { category: true, description: true, amount: true }
  });
  exps.forEach(exp => console.log(`  [${exp.category}] ${exp.description}: Rp ${exp.amount.toLocaleString('id-ID')}`));

}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
