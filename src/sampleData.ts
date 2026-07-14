import { SalesRecord } from "./types";

export function getStoreId(storeName: string): string {
  const storeIdMap: { [key: string]: string } = {
    "Flagship Store NY": "STR-101",
    "Boutique West LA": "STR-102",
    "Metro Express Chicago": "STR-103",
    "Digital Store Online": "STR-104",
    "Hub South Miami": "STR-105",
    "Core North Boston": "STR-106",
  };
  if (storeIdMap[storeName]) return storeIdMap[storeName];
  let hash = 0;
  for (let i = 0; i < storeName.length; i++) {
    hash = storeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idNum = Math.abs(hash % 1000) + 107;
  return `STR-${idNum}`;
}

export function getStoreName(storeId: string): string {
  if (!storeId) return "";
  const storeIdClean = String(storeId).trim().toUpperCase();
  const nameMap: { [key: string]: string } = {
    "STR-101": "Flagship Store NY",
    "STR-102": "Boutique West LA",
    "STR-103": "Metro Express Chicago",
    "STR-104": "Digital Store Online",
    "STR-105": "Hub South Miami",
    "STR-106": "Core North Boston",
    "ST-001": "Flagship Store NY",
    "ST-002": "Boutique West LA",
    "ST-003": "Metro Express Chicago",
    "ST-004": "Digital Store Online",
    "ST-005": "Hub South Miami",
    "ST-006": "Core North Boston",
    "ST-101": "Flagship Store NY",
    "ST-102": "Boutique West LA",
    "ST-103": "Metro Express Chicago",
    "ST-104": "Digital Store Online",
    "ST-105": "Hub South Miami",
    "ST-106": "Core North Boston",
  };
  return nameMap[storeIdClean] || storeId;
}

export function normalizeWeek(w: any): string {
  if (!w) return "Week 1";
  const str = String(w).trim();
  const upper = str.toUpperCase();
  const clean = upper.replace(/[^A-Z0-9]/g, ""); // e.g. "WEEK1" or "W1" or "1"
  
  // Explicit standard week matches
  if (clean === "W1" || clean === "1" || clean === "WEEK1" || clean === "WEEK01") return "Week 1";
  if (clean === "W2" || clean === "2" || clean === "WEEK2" || clean === "WEEK02") return "Week 2";
  if (clean === "W3" || clean === "3" || clean === "WEEK3" || clean === "WEEK03") return "Week 3";
  if (clean === "W4" || clean === "4" || clean === "WEEK4" || clean === "WEEK04") return "Week 4";
  if (clean === "W5" || clean === "5" || clean === "WEEK5" || clean === "WEEK05") return "Week 5";

  // Check loose matches for Week prefixes
  if (upper.includes("WEEK 1") || upper.includes("WEEK01") || upper === "W1" || upper === "WK1" || upper === "WK 1") return "Week 1";
  if (upper.includes("WEEK 2") || upper.includes("WEEK02") || upper === "W2" || upper === "WK2" || upper === "WK 2") return "Week 2";
  if (upper.includes("WEEK 3") || upper.includes("WEEK03") || upper === "W3" || upper === "WK3" || upper === "WK 3") return "Week 3";
  if (upper.includes("WEEK 4") || upper.includes("WEEK04") || upper === "W4" || upper === "WK4" || upper === "WK 4") return "Week 4";
  if (upper.includes("WEEK 5") || upper.includes("WEEK05") || upper === "W5" || upper === "WK5" || upper === "WK 5") return "Week 5";

  // If it's a date or custom format, keep it intact
  return str;
}

export function enrichRecord(r: any, idx: number): SalesRecord {
  // Determine week from date day
  const day = r.date ? parseInt(r.date.split("-")[2], 10) : 1;
  const weekStr = day <= 7 ? "Week 1" : day <= 14 ? "Week 2" : day <= 21 ? "Week 3" : day <= 28 ? "Week 4" : "Week 5";
  
  // Deterministic stores, cities, and formats
  const storeNames = ["Flagship Store NY", "Boutique West LA", "Metro Express Chicago", "Digital Store Online", "Hub South Miami", "Core North Boston"];
  const cities = ["New York", "Los Angeles", "Chicago", "Seattle", "Miami", "Boston"];
  const formats = ["Flagship", "Boutique", "Express", "Online"];
  
  const storeIdx = idx % storeNames.length;
  let store = r.store || storeNames[storeIdx];
  store = getStoreName(store);
  
  const city = r.city || cities[storeIdx];
  const storeFormat = r.storeFormat || formats[idx % formats.length];
  const storeId = r.storeId || getStoreId(store);
  
  // Return amount: let's make some items have returns (especially higher return categories like Apparel)
  let returnPct = 0;
  if (r.category === "Apparel") {
    returnPct = idx % 3 === 0 ? 0.22 : 0.04;
  } else if (r.category === "Electronics") {
    returnPct = idx % 5 === 0 ? 0.12 : 0;
  } else {
    returnPct = idx % 7 === 0 ? 0.08 : 0;
  }
  const returnAmount = r.returnAmount !== undefined ? Number(r.returnAmount) : Math.round(r.sales * returnPct * 10) / 10;
  
  // Discount amount
  const discountRate = idx % 4 === 0 ? 0.18 : idx % 3 === 0 ? 0.08 : idx % 5 === 0 ? 0.05 : 0;
  const discountAmount = r.discountAmount !== undefined ? Number(r.discountAmount) : Math.round(r.sales * discountRate * 10) / 10;
  
  // Target Sales: target is around 95% of sales on average
  const multiplier = 0.85 + ((idx * 7) % 35) / 100; // 0.85 to 1.20
  const targetSales = r.targetSales !== undefined ? Number(r.targetSales) : Math.round(r.sales * multiplier);
  
  // Stock level: low stock for some items (stockout risk)
  const stockLevel = (r.stockLevel !== undefined && r.stockLevel !== null && r.stockLevel !== "")
    ? Number(r.stockLevel)
    : (idx * 23) % 95; // range 0 to 94
  
  return {
    id: r.id ? String(r.id) : String(idx + 1),
    date: r.date || "2026-01-01",
    category: r.category || "General",
    product: r.product || "Product",
    sales: Number(r.sales) || 0,
    quantity: Number(r.quantity) || 1,
    profit: Number(r.profit) || 0,
    region: r.region || "East",
    segment: r.segment || "Consumer",
    returnAmount,
    discountAmount,
    targetSales,
    store,
    storeId,
    city,
    storeFormat,
    week: normalizeWeek(r.week || weekStr),
    stockLevel
  };
}

const RAW_SALES_DATA = [
  // January 2026
  { id: "1", date: "2026-01-05", category: "Electronics", product: "Wireless Headphones", sales: 1200, quantity: 8, profit: 480, region: "East", segment: "Consumer" },
  { id: "2", date: "2026-01-08", category: "Apparel", product: "Running Shoes", sales: 850, quantity: 10, profit: 340, region: "West", segment: "Consumer" },
  { id: "3", date: "2026-01-12", category: "Home & Kitchen", product: "Coffee Maker", sales: 1500, quantity: 15, profit: 450, region: "North", segment: "Corporate" },
  { id: "4", date: "2026-01-15", category: "Beauty & Personal Care", product: "Electric Toothbrush", sales: 450, quantity: 5, profit: 180, region: "South", segment: "Home Office" },
  { id: "5", date: "2026-01-18", category: "Electronics", product: "Smart Watch", sales: 2400, quantity: 12, profit: 960, region: "West", segment: "Corporate" },
  { id: "6", date: "2026-01-22", category: "Apparel", product: "Denim Jacket", sales: 650, quantity: 5, profit: 260, region: "East", segment: "Consumer" },
  { id: "7", date: "2026-01-25", category: "Home & Kitchen", product: "Air Fryer", sales: 1800, quantity: 12, profit: 540, region: "South", segment: "Consumer" },
  { id: "8", date: "2026-01-29", category: "Beauty & Personal Care", product: "Face Serum", sales: 320, quantity: 8, profit: 160, region: "North", segment: "Corporate" },

  // February 2026
  { id: "9", date: "2026-02-02", category: "Electronics", product: "Bluetooth Speaker", sales: 750, quantity: 10, profit: 300, region: "East", segment: "Consumer" },
  { id: "10", date: "2026-02-05", category: "Apparel", product: "Wool Scarf", sales: 240, quantity: 12, profit: 96, region: "North", segment: "Home Office" },
  { id: "11", date: "2026-02-10", category: "Home & Kitchen", product: "Blender", sales: 1100, quantity: 11, profit: 330, region: "West", segment: "Corporate" },
  { id: "12", date: "2026-02-14", category: "Beauty & Personal Care", product: "Hair Dryer", sales: 950, quantity: 10, profit: 380, region: "South", segment: "Consumer" },
  { id: "13", date: "2026-02-18", category: "Electronics", product: "Wireless Headphones", sales: 1500, quantity: 10, profit: 600, region: "West", segment: "Consumer" },
  { id: "14", date: "2026-02-21", category: "Apparel", product: "Running Shoes", sales: 1105, quantity: 13, profit: 442, region: "South", segment: "Corporate" },
  { id: "15", date: "2026-02-25", category: "Home & Kitchen", product: "Chef Knife Set", sales: 1350, quantity: 9, profit: 405, region: "East", segment: "Home Office" },
  { id: "16", date: "2026-02-28", category: "Beauty & Personal Care", product: "Beard Trimmer", sales: 520, quantity: 8, profit: 208, region: "North", segment: "Consumer" },

  // March 2026
  { id: "17", date: "2026-03-03", category: "Electronics", product: "Smart Watch", sales: 3000, quantity: 15, profit: 1200, region: "North", segment: "Consumer" },
  { id: "18", date: "2026-03-07", category: "Apparel", product: "Athletic Tee", sales: 480, quantity: 16, profit: 192, region: "East", segment: "Corporate" },
  { id: "19", date: "2026-03-12", category: "Home & Kitchen", product: "Coffee Maker", sales: 1800, quantity: 18, profit: 540, region: "West", segment: "Consumer" },
  { id: "20", date: "2026-03-16", category: "Beauty & Personal Care", product: "Electric Toothbrush", sales: 720, quantity: 8, profit: 288, region: "South", segment: "Consumer" },
  { id: "21", date: "2026-03-20", category: "Electronics", product: "Laptop Stand", sales: 620, quantity: 10, profit: 248, region: "West", segment: "Home Office" },
  { id: "22", date: "2026-03-24", category: "Apparel", product: "Leather Belt", sales: 350, quantity: 7, profit: 140, region: "South", segment: "Consumer" },
  { id: "23", date: "2026-03-27", category: "Home & Kitchen", product: "Air Fryer", sales: 2250, quantity: 15, profit: 675, region: "North", segment: "Corporate" },
  { id: "24", date: "2026-03-31", category: "Beauty & Personal Care", product: "Clay Mask", sales: 280, quantity: 14, profit: 140, region: "East", segment: "Consumer" },

  // April 2026
  { id: "25", date: "2026-04-04", category: "Electronics", product: "Bluetooth Speaker", sales: 900, quantity: 12, profit: 360, region: "South", segment: "Corporate" },
  { id: "26", date: "2026-04-08", category: "Apparel", product: "Denim Jacket", sales: 910, quantity: 7, profit: 364, region: "West", segment: "Home Office" },
  { id: "27", date: "2026-04-12", category: "Home & Kitchen", product: "Food Storage Containers", sales: 480, quantity: 16, profit: 144, region: "East", segment: "Consumer" },
  { id: "28", date: "2026-04-15", category: "Beauty & Personal Care", product: "Face Serum", sales: 480, quantity: 12, profit: 240, region: "North", segment: "Consumer" },
  { id: "29", date: "2026-04-19", category: "Electronics", product: "Wireless Headphones", sales: 1950, quantity: 13, profit: 780, region: "North", segment: "Consumer" },
  { id: "30", date: "2026-04-22", category: "Apparel", product: "Running Shoes", sales: 1530, quantity: 18, profit: 612, region: "East", segment: "Corporate" },
  { id: "31", date: "2026-04-26", category: "Home & Kitchen", product: "Blender", sales: 1300, quantity: 13, profit: 390, region: "South", segment: "Home Office" },
  { id: "32", date: "2026-04-30", category: "Beauty & Personal Care", product: "Hair Dryer", sales: 1140, quantity: 12, profit: 456, region: "West", segment: "Consumer" },

  // May 2026
  { id: "33", date: "2026-05-03", category: "Electronics", product: "Smart Watch", sales: 3800, quantity: 19, profit: 1520, region: "East", segment: "Consumer" },
  { id: "34", date: "2026-05-07", category: "Apparel", product: "Athletic Tee", sales: 600, quantity: 20, profit: 240, region: "North", segment: "Consumer" },
  { id: "35", date: "2026-05-11", category: "Home & Kitchen", product: "Air Fryer", sales: 2700, quantity: 18, profit: 810, region: "West", segment: "Corporate" },
  { id: "36", date: "2026-05-15", category: "Beauty & Personal Care", product: "Electric Toothbrush", sales: 900, quantity: 10, profit: 360, region: "South", segment: "Corporate" },
  { id: "37", date: "2026-05-19", category: "Electronics", product: "Charging Dock", sales: 450, quantity: 15, profit: 180, region: "South", segment: "Home Office" },
  { id: "38", date: "2026-05-23", category: "Apparel", product: "Wool Scarf", sales: 180, quantity: 9, profit: 72, region: "East", segment: "Consumer" },
  { id: "39", date: "2026-05-27", category: "Home & Kitchen", product: "Coffee Maker", sales: 2200, quantity: 22, profit: 660, region: "North", segment: "Consumer" },
  { id: "40", date: "2026-05-31", category: "Beauty & Personal Care", product: "Beard Trimmer", sales: 650, quantity: 10, profit: 260, region: "West", segment: "Corporate" },

  // June 2026
  { id: "41", date: "2026-06-02", category: "Electronics", product: "Wireless Headphones", sales: 2400, quantity: 16, profit: 960, region: "South", segment: "Consumer" },
  { id: "42", date: "2026-06-05", category: "Apparel", product: "Running Shoes", sales: 1870, quantity: 22, profit: 748, region: "West", segment: "Corporate" },
  { id: "43", date: "2026-06-09", category: "Home & Kitchen", product: "Chef Knife Set", sales: 1650, quantity: 11, profit: 495, region: "North", segment: "Home Office" },
  { id: "44", date: "2026-06-12", category: "Beauty & Personal Care", product: "Face Serum", sales: 640, quantity: 16, profit: 320, region: "East", segment: "Consumer" },
  { id: "45", date: "2026-06-15", category: "Electronics", product: "Smart Watch", sales: 4400, quantity: 22, profit: 1760, region: "West", segment: "Consumer" },
  { id: "46", date: "2026-06-18", category: "Apparel", product: "Denim Jacket", sales: 1170, quantity: 9, profit: 468, region: "North", segment: "Corporate" },
  { id: "47", date: "2026-06-22", category: "Home & Kitchen", product: "Air Fryer", sales: 3150, quantity: 21, profit: 945, region: "South", segment: "Consumer" },
  { id: "48", date: "2026-06-25", category: "Beauty & Personal Care", product: "Hair Dryer", sales: 1330, quantity: 14, profit: 532, region: "East", segment: "Corporate" },
  { id: "49", date: "2026-06-28", category: "Electronics", product: "Bluetooth Speaker", sales: 1200, quantity: 16, profit: 480, region: "East", segment: "Home Office" },
  { id: "50", date: "2026-06-30", category: "Home & Kitchen", product: "Blender", sales: 1600, quantity: 16, profit: 480, region: "North", segment: "Consumer" },
];

export const SAMPLE_SALES_DATA: SalesRecord[] = RAW_SALES_DATA.map((r, idx) => enrichRecord(r, idx));
