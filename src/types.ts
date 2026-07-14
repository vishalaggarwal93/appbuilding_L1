export interface SalesRecord {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  product: string;
  sales: number; // Gross sales
  quantity: number;
  profit: number;
  region: string;
  segment: string;
  
  // New properties for retail expansion
  returnAmount: number;
  discountAmount: number;
  targetSales: number;
  store: string;
  storeId: string;
  city: string;
  storeFormat: string;
  week: string; // e.g. "W1", "W2", "W3", "W4", "W5"
  stockLevel: number; // Current stock count for stockout risk
}

export interface SalesMetrics {
  grossSales: number;
  netSales: number;
  totalQuantity: number;
  totalProfit: number;
  totalReturnAmount: number;
  totalDiscountAmount: number;
  targetSales: number;
  targetAchievement: number; // netSales / targetSales * 100
  averageTransactionValue: number; // netSales / transaction count
  returnRate: number; // totalReturnAmount / netSales * 100
  averageDiscountRate: number; // totalDiscountAmount / grossSales * 100
  averageMargin: number; // totalProfit / netSales
  growthRate: number;
}

export interface DashboardFilters {
  dateRange: { start: string; end: string };
  categories: string[];
  regions: string[];
  segments: string[];
  searchQuery: string;
  weeks: string[];
  stores: string[];
  cities: string[];
  storeFormats: string[];
}

export interface AIInsight {
  title: string;
  type: "positive" | "warning" | "neutral" | "opportunity";
  description: string;
  actionableStep: string;
}

export interface AIResponse {
  summary: string;
  insights: AIInsight[];
  forecast: {
    nextMonthEstimate: number;
    trendDirection: "up" | "down" | "flat";
    confidenceScore: number;
    explanation: string;
  };
}
