// src/lib/price-history.ts

export function calculatePriceChange(oldPrice: number | null | undefined, newPrice: number) {
  const safeOldPrice = oldPrice || 0;
  
  if (safeOldPrice === newPrice) {
    return { changeAmount: 0, changePercentage: 0 };
  }

  const changeAmount = newPrice - safeOldPrice;
  
  let changePercentage = 0;
  if (safeOldPrice === 0) {
    changePercentage = newPrice > 0 ? 100 : 0;
  } else {
    changePercentage = (changeAmount / safeOldPrice) * 100;
  }

  return { 
    changeAmount, 
    changePercentage: Number(changePercentage.toFixed(2)) 
  };
}