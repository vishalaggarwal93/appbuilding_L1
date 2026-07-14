import React, { useState } from "react";
import { SalesRecord } from "../types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  Tag,
  MapPin,
  Building2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  getWeeklyTrendData,
  getCategoryData,
  getRegionData,
  getStoreLeaderboardData,
  getStockoutRiskData,
} from "../utils/metrics";

interface ChartsGridProps {
  records: SalesRecord[];
}

const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#38BDF8", "#F43F5E"];

export default function ChartsGrid({ records }: ChartsGridProps) {
  const [activeTab, setActiveTab] = useState<"performance" | "retail">("performance");

  const weeklyTrendData = getWeeklyTrendData(records);
  const categoryData = getCategoryData(records);
  const regionData = getRegionData(records);
  const storeLeaderboard = getStoreLeaderboardData(records);
  const stockoutRisk = getStockoutRiskData(records);

  const formatCurrency = (val: number) => {
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatYAxis = (val: number) => {
    if (val >= 1e6) {
      return `$${(val / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (val >= 1e3) {
      return `$${(val / 1e3).toFixed(0)}K`;
    }
    return `$${val}`;
  };

  const hasData = records.length > 0;

  return (
    <div className="space-y-6">
      {/* Tab Selectors to balance the data density */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200/50">
          <button
            onClick={() => setActiveTab("performance")}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
              activeTab === "performance"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Performance & Trends
          </button>
          <button
            onClick={() => setActiveTab("retail")}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
              activeTab === "retail"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Stores & Stockout Risks
          </button>
        </div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
          Interactive Analytics Canvas
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!hasData ? (
          <motion.div
            key="no-data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white p-12 rounded-lg border border-slate-200 shadow-sm text-center"
          >
            <Info className="mx-auto h-8 w-8 text-slate-400 mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No sales transactions match the active filters</h3>
            <p className="text-xs text-slate-500 mt-1">Please try modifying your date, region, category, or store criteria.</p>
          </motion.div>
        ) : activeTab === "performance" ? (
          <motion.div
            key="tab-performance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* 1. Weekly Sales & Return Trend */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Weekly Revenue & Returns Trend</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Performance tracking across current active weeks</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Weekly View</span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWeekSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWeekReturns" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="week" tickLine={false} tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }} />
                    <YAxis width={65} tickLine={false} tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }} />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val), ""]}
                      contentStyle={{ backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "10px", marginTop: "10px", fontWeight: 600 }} />
                    <Area name="Net Sales" type="monotone" dataKey="netSales" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorWeekSales)" />
                    <Area name="Return Amount" type="monotone" dataKey="returns" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#colorWeekReturns)" />
                    <Line name="Net Profit" type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Regional Sales Share */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Sales by Region</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Revenue breakdown by operating territories</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Donut View</span>
              </div>

              <div className="h-44 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={regionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="netSales"
                    >
                      {regionData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val), "Net Sales"]}
                      contentStyle={{ backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "10px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Net</span>
                  <p className="text-xs font-extrabold text-[#0F172A] leading-tight">
                    {formatCurrency(regionData.reduce((acc, curr) => acc + curr.netSales, 0))}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[105px] overflow-y-auto pr-1">
                {regionData.map((reg, idx) => {
                  const total = regionData.reduce((acc, curr) => acc + curr.netSales, 0);
                  const pct = total > 0 ? (reg.netSales / total) * 100 : 0;
                  return (
                    <div key={reg.region} className="flex items-center justify-between text-[11px] leading-relaxed">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                        <span
                          className="h-2 w-2 rounded-full inline-block"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span>{reg.region} Region</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{formatCurrency(reg.netSales)}</span>
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Category Performance */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4 lg:col-span-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Category Net Sales & Profitability Analysis</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Comparison of revenue, net profit, returns, and markdown rate per category</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Category Rank</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="h-64 lg:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="category" tickLine={false} tick={{ fontSize: 9, fill: "#64748b", fontWeight: 600 }} />
                      <YAxis width={65} tickLine={false} tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }} />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), ""]}
                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: "10px", marginTop: "10px", fontWeight: 600 }} />
                      <Bar name="Net Sales" dataKey="netSales" fill="#3B82F6" radius={[2, 2, 0, 0]} barSize={25} />
                      <Bar name="Profit" dataKey="profit" fill="#8B5CF6" radius={[2, 2, 0, 0]} barSize={25} />
                      <Bar name="Returns Writeoff" dataKey="returns" fill="#F43F5E" radius={[2, 2, 0, 0]} barSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metrics Highlights</h4>
                  {categoryData.slice(0, 3).map((cat, idx) => (
                    <div key={cat.category} className="space-y-1 pb-2 border-b border-slate-200 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>{cat.category}</span>
                        <span>{formatCurrency(cat.netSales)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                        <span>Margin: <strong className="text-emerald-600">{cat.margin.toFixed(1)}%</strong></span>
                        <span>Return Rate: <strong className="text-rose-600">{cat.returnRate.toFixed(1)}%</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="tab-retail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* 4. Store Leaderboard */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Store Leaderboard</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Top performing retail stores with target achievement rates</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Store Ranking</span>
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {storeLeaderboard.slice(0, 8).map((store, i) => {
                  const achievementPct = Math.min(100, store.achievement);
                  const isExceeded = store.achievement >= 100;

                  return (
                    <div key={store.store} className="space-y-1 p-2.5 rounded bg-slate-50 border border-slate-150">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-mono text-slate-400">0{i + 1}</span>
                          <span className="text-[#0F172A] truncate">{store.store}</span>
                          <span className="text-[9px] font-medium text-slate-400 bg-slate-200 px-1 rounded uppercase tracking-wide">
                            {store.format}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#0F172A]">{formatCurrency(store.netSales)}</span>
                          <span className="text-[9px] text-slate-400 block font-normal">Target: {formatCurrency(store.targetSales)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                          <span>{store.city}</span>
                          <span className={isExceeded ? "text-emerald-600" : "text-amber-600"}>
                            {store.achievement}% Achieved
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all ${isExceeded ? "bg-emerald-500" : "bg-amber-500"}`}
                            style={{ width: `${achievementPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Stockout Risk */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Stockout Risk & Inventory Tracker</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Critical products sorted by lowest current stock levels</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Urgent Actions</span>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {stockoutRisk.slice(0, 8).map((item, idx) => {
                  const pct = Math.min(100, (item.stockLevel / 95) * 100);
                  const isHigh = item.riskLevel === "High";
                  const isMedium = item.riskLevel === "Medium";
                  
                  return (
                    <div
                      key={item.product}
                      className={`p-2.5 rounded border transition-colors ${
                        isHigh 
                          ? "bg-rose-50/50 border-rose-200 hover:bg-rose-50" 
                          : isMedium 
                          ? "bg-amber-50/50 border-amber-200 hover:bg-amber-50" 
                          : "bg-slate-50/50 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="truncate pr-2">
                          <h4 className="text-slate-800 truncate">{item.product}</h4>
                          <span className="text-[9px] font-medium text-slate-400 block">{item.category}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold ${
                            isHigh 
                              ? "bg-rose-100 text-rose-700" 
                              : isMedium 
                              ? "bg-amber-100 text-amber-700" 
                              : "bg-slate-200 text-slate-700"
                          }`}>
                            {item.riskLevel} Risk
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold block mt-1">Stock: {item.stockLevel} units</span>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="w-full h-1.5 bg-slate-200 rounded overflow-hidden">
                          <div
                            className={`h-full rounded ${
                              isHigh ? "bg-rose-500" : isMedium ? "bg-amber-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold">
                          <span>Volume Sold: {item.salesVolume} units</span>
                          <span>Inventory Health: {Math.round(pct)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
