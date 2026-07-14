import { SalesRecord, SalesMetrics } from "../types";

export function calculateMetrics(records: SalesRecord[]): SalesMetrics {
  if (records.length === 0) {
    return {
      grossSales: 0,
      netSales: 0,
      totalQuantity: 0,
      totalProfit: 0,
      totalReturnAmount: 0,
      totalDiscountAmount: 0,
      targetSales: 0,
      targetAchievement: 0,
      averageTransactionValue: 0,
      returnRate: 0,
      averageDiscountRate: 0,
      averageMargin: 0,
      growthRate: 0,
    };
  }

  let grossSales = 0;
  let totalQuantity = 0;
  let totalProfit = 0;
  let totalReturnAmount = 0;
  let totalDiscountAmount = 0;
  let targetSales = 0;

  records.forEach((r) => {
    grossSales += r.sales;
    totalQuantity += r.quantity;
    totalProfit += r.profit;
    totalReturnAmount += r.returnAmount || 0;
    totalDiscountAmount += r.discountAmount || 0;
    targetSales += r.targetSales || r.sales;
  });

  const netSales = Math.max(0, grossSales - totalReturnAmount);
  const targetAchievement = targetSales > 0 ? (netSales / targetSales) * 100 : 100;
  const averageTransactionValue = records.length > 0 ? netSales / records.length : 0;
  const returnRate = netSales > 0 ? (totalReturnAmount / netSales) * 100 : 0;
  const averageDiscountRate = grossSales > 0 ? (totalDiscountAmount / grossSales) * 100 : 0;
  const averageMargin = netSales > 0 ? totalProfit / netSales : 0;

  // Compute growth rate based on timeline
  const monthlyTotals = getTimelineData(records);
  let growthRate = 0;
  if (monthlyTotals.length >= 2) {
    const firstMonthSales = monthlyTotals[0].sales;
    const lastMonthSales = monthlyTotals[monthlyTotals.length - 1].sales;
    if (firstMonthSales > 0) {
      growthRate = (lastMonthSales - firstMonthSales) / firstMonthSales;
    }
  }

  return {
    grossSales,
    netSales,
    totalQuantity,
    totalProfit,
    totalReturnAmount,
    totalDiscountAmount,
    targetSales,
    targetAchievement,
    averageTransactionValue,
    returnRate,
    averageDiscountRate,
    averageMargin,
    growthRate,
  };
}

export function getTimelineData(records: SalesRecord[]) {
  const groups: { [key: string]: { date: string; sales: number; profit: number; quantity: number } } = {};

  records.forEach((r) => {
    const month = r.date.substring(0, 7);
    if (!groups[month]) {
      groups[month] = { date: month, sales: 0, profit: 0, quantity: 0 };
    }
    groups[month].sales += r.sales;
    groups[month].profit += r.profit;
    groups[month].quantity += r.quantity;
  });

  return Object.keys(groups)
    .sort()
    .map((month) => {
      const parts = month.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dateLabel = parts.length === 2 
        ? `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`
        : month;
        
      return {
        monthKey: month,
        monthLabel: dateLabel,
        sales: Math.round(groups[month].sales),
        profit: Math.round(groups[month].profit),
        quantity: groups[month].quantity,
      };
    });
}

export function getWeeklyTrendData(records: SalesRecord[]) {
  // Extract all unique week values present in the active dataset
  const rawWeeks = Array.from(new Set(records.map((r) => r.week).filter(Boolean))) as string[];

  if (rawWeeks.length === 0) {
    return [];
  }

  const isGenericWeek = (w: string) => /^[Ww](eek)?\s*\d+$/.test(w.trim());
  const hasNonGenericWeeks = rawWeeks.some((w) => !isGenericWeek(w));
  const uniqueWeeks = hasNonGenericWeeks
    ? rawWeeks.filter((w) => !isGenericWeek(w))
    : rawWeeks;

  // Parse custom week date strings (e.g. DD-MM-YYYY) for chronological sorting
  const parseDateHelper = (str: string) => {
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year > 1000) {
        if (month > 12 && day <= 12) {
          const temp = day;
          day = month;
          month = temp;
        }
        return new Date(year, month - 1, day).getTime();
      }
    }
    const t = Date.parse(str);
    return isNaN(t) ? 0 : t;
  };

  // Sort weeks intelligently: standard "Week X" numerically, date formats chronologically
  uniqueWeeks.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
    const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
    const isWeekA = a.toUpperCase().startsWith("WEEK") || a.toUpperCase().startsWith("W");
    const isWeekB = b.toUpperCase().startsWith("WEEK") || b.toUpperCase().startsWith("W");

    if (isWeekA && isWeekB && !isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    const timeA = parseDateHelper(a);
    const timeB = parseDateHelper(b);
    if (timeA !== 0 && timeB !== 0) {
      return timeA - timeB;
    }

    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  const groups: { [key: string]: { week: string; sales: number; netSales: number; returns: number; profit: number } } = {};
  uniqueWeeks.forEach((w) => {
    groups[w] = { week: w, sales: 0, netSales: 0, returns: 0, profit: 0 };
  });

  records.forEach((r) => {
    const w = r.week;
    if (w && groups[w]) {
      groups[w].sales += r.sales;
      groups[w].netSales += (r.sales - (r.returnAmount || 0));
      groups[w].returns += (r.returnAmount || 0);
      groups[w].profit += r.profit;
    }
  });

  return uniqueWeeks.map((wk) => ({
    week: groups[wk].week,
    weekKey: wk,
    sales: Math.round(groups[wk].sales),
    netSales: Math.max(0, Math.round(groups[wk].netSales)),
    returns: Math.round(groups[wk].returns),
    profit: Math.round(groups[wk].profit),
  }));
}

export function getCategoryData(records: SalesRecord[]) {
  const groups: { [key: string]: { category: string; sales: number; netSales: number; profit: number; returns: number; quantity: number } } = {};

  records.forEach((r) => {
    if (!groups[r.category]) {
      groups[r.category] = { category: r.category, sales: 0, netSales: 0, profit: 0, returns: 0, quantity: 0 };
    }
    groups[r.category].sales += r.sales;
    groups[r.category].netSales += (r.sales - (r.returnAmount || 0));
    groups[r.category].returns += r.returnAmount || 0;
    groups[r.category].profit += r.profit;
    groups[r.category].quantity += r.quantity;
  });

  return Object.values(groups).map((g) => ({
    ...g,
    sales: Math.round(g.sales),
    netSales: Math.max(0, Math.round(g.netSales)),
    profit: Math.round(g.profit),
    returns: Math.round(g.returns),
    returnRate: g.sales > 0 ? (g.returns / g.sales) * 100 : 0,
    margin: g.netSales > 0 ? (g.profit / g.netSales) * 100 : 0,
  })).sort((a, b) => b.netSales - a.netSales);
}

export function getRegionData(records: SalesRecord[]) {
  const groups: { [key: string]: { region: string; sales: number; netSales: number; profit: number; returns: number } } = {};

  records.forEach((r) => {
    if (!groups[r.region]) {
      groups[r.region] = { region: r.region, sales: 0, netSales: 0, profit: 0, returns: 0 };
    }
    groups[r.region].sales += r.sales;
    groups[r.region].netSales += (r.sales - (r.returnAmount || 0));
    groups[r.region].returns += r.returnAmount || 0;
    groups[r.region].profit += r.profit;
  });

  return Object.values(groups).map((g) => ({
    ...g,
    sales: Math.round(g.sales),
    netSales: Math.max(0, Math.round(g.netSales)),
    profit: Math.round(g.profit),
    returns: Math.round(g.returns),
  })).sort((a, b) => b.netSales - a.netSales);
}

export function getStoreLeaderboardData(records: SalesRecord[]) {
  const groups: { [key: string]: { store: string; storeId: string; city: string; format: string; netSales: number; targetSales: number; count: number } } = {};

  records.forEach((r) => {
    const s = r.store || "Unknown Store";
    if (!groups[s]) {
      groups[s] = { store: s, storeId: r.storeId || "", city: r.city || "Unknown", format: r.storeFormat || "Retail", netSales: 0, targetSales: 0, count: 0 };
    }
    groups[s].netSales += (r.sales - (r.returnAmount || 0));
    groups[s].targetSales += r.targetSales || r.sales;
    groups[s].count += 1;
  });

  return Object.values(groups).map((g) => {
    const achievement = g.targetSales > 0 ? (g.netSales / g.targetSales) * 100 : 100;
    return {
      ...g,
      netSales: Math.max(0, Math.round(g.netSales)),
      targetSales: Math.round(g.targetSales),
      achievement: Math.round(achievement),
    };
  }).sort((a, b) => b.netSales - a.netSales);
}

export function getStockoutRiskData(records: SalesRecord[]) {
  const groups: { [key: string]: { product: string; category: string; stockLevel: number; salesVolume: number; count: number } } = {};

  records.forEach((r) => {
    const p = r.product;
    if (!p || p.toLowerCase() === "product item" || p.toLowerCase() === "product") {
      return;
    }
    if (!groups[p]) {
      groups[p] = { product: p, category: r.category, stockLevel: r.stockLevel ?? 100, salesVolume: 0, count: 0 };
    }
    groups[p].salesVolume += r.quantity;
    groups[p].count += 1;
    // Keep minimum stock level
    if (r.stockLevel !== undefined && r.stockLevel < groups[p].stockLevel) {
      groups[p].stockLevel = r.stockLevel;
    }
  });

  return Object.values(groups).map((g) => {
    // Risk ratio = salesVolume / stockLevel
    const riskRatio = g.stockLevel > 0 ? g.salesVolume / g.stockLevel : g.salesVolume;
    let riskLevel: "High" | "Medium" | "Low" = "Low";
    if (g.stockLevel <= 15) riskLevel = "High";
    else if (g.stockLevel <= 35) riskLevel = "Medium";

    return {
      ...g,
      riskRatio,
      riskLevel,
    };
  }).sort((a, b) => a.stockLevel - b.stockLevel); // Sort by lowest stock first
}

export function getProductData(records: SalesRecord[], limit = 5) {
  const groups: { [key: string]: { product: string; category: string; sales: number; quantity: number; profit: number } } = {};

  records.forEach((r) => {
    const p = r.product;
    if (!p || p.toLowerCase() === "product item" || p.toLowerCase() === "product") {
      return;
    }
    if (!groups[p]) {
      groups[p] = { product: p, category: r.category, sales: 0, quantity: 0, profit: 0 };
    }
    groups[p].sales += r.sales;
    groups[p].quantity += r.quantity;
    groups[p].profit += r.profit;
  });

  return Object.values(groups)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit);
}

export function getSegmentData(records: SalesRecord[]) {
  const groups: { [key: string]: { name: string; sales: number; profit: number; quantity: number } } = {};

  records.forEach((r) => {
    if (!groups[r.segment]) {
      groups[r.segment] = { name: r.segment, sales: 0, profit: 0, quantity: 0 };
    }
    groups[r.segment].sales += r.sales;
    groups[r.segment].profit += r.profit;
    groups[r.segment].quantity += r.quantity;
  });

  return Object.values(groups).map((g) => ({
    ...g,
    sales: Math.round(g.sales),
    profit: Math.round(g.profit),
  })).sort((a, b) => b.sales - a.sales);
}
