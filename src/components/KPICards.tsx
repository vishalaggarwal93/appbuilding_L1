import React from "react";
import { SalesMetrics } from "../types";
import { DollarSign, Target, Receipt, RotateCcw, Percent } from "lucide-react";
import { motion } from "motion/react";

interface KPICardsProps {
  metrics: SalesMetrics;
}

export default function KPICards({ metrics }: KPICardsProps) {
  const formatCurrency = (val: number) => {
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const cards = [
    {
      id: "net-sales-kpi",
      title: "Net Sales",
      value: formatCurrency(metrics.netSales),
      subtitle: `Gross: ${formatCurrency(metrics.grossSales)}`,
      icon: DollarSign,
      color: "bg-blue-50 text-blue-600 border-blue-200/80",
      description: "Revenue minus returns and write-offs",
    },
    {
      id: "target-achievement-kpi",
      title: "Target Achievement",
      value: `${metrics.targetAchievement.toFixed(1)}%`,
      subtitle: `Target: ${formatCurrency(metrics.targetSales)}`,
      icon: Target,
      color: metrics.targetAchievement >= 100 
        ? "bg-emerald-50 text-emerald-600 border-emerald-200/80" 
        : "bg-amber-50 text-amber-600 border-amber-200/80",
      description: "Net sales vs target performance",
    },
    {
      id: "atv-kpi",
      title: "Average Transaction Value",
      value: `$${metrics.averageTransactionValue.toFixed(2)}`,
      subtitle: "Per transaction line",
      icon: Receipt,
      color: "bg-indigo-50 text-indigo-600 border-indigo-200/80",
      description: "Average net value of each sale line",
    },
    {
      id: "return-rate-kpi",
      title: "Return Rate",
      value: `${metrics.returnRate.toFixed(2)}%`,
      subtitle: `Returns: ${formatCurrency(metrics.totalReturnAmount)}`,
      icon: RotateCcw,
      color: metrics.returnRate > 10 
        ? "bg-rose-50 text-rose-600 border-rose-200/80" 
        : "bg-slate-50 text-slate-600 border-slate-200",
      description: "Returned merchandise value ratio",
    },
    {
      id: "discount-rate-kpi",
      title: "Avg. Discount Rate",
      value: `${metrics.averageDiscountRate.toFixed(1)}%`,
      subtitle: `Discounts: ${formatCurrency(metrics.totalDiscountAmount)}`,
      icon: Percent,
      color: "bg-purple-50 text-purple-600 border-purple-200/80",
      description: "Total markdowns applied to gross",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.title}</span>
            <div className={`p-1.5 rounded border ${card.color}`}>
              <card.icon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className="text-xl md:text-2xl font-bold text-[#0F172A] tracking-tight">{card.value}</h3>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
              <span>{card.subtitle}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold leading-normal pt-1 border-t border-slate-100 mt-1">{card.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
