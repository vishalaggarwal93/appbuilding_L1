import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowRight, 
  RefreshCw,
  Loader2,
  TrendingUp,
  BrainCircuit
} from "lucide-react";
import { SalesRecord, AIResponse, AIInsight } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { calculateMetrics, getTimelineData, getCategoryData, getRegionData, getProductData, getStoreLeaderboardData } from "../utils/metrics";

interface AIInsightsPanelProps {
  records: SalesRecord[];
}

const LOADING_MESSAGES = [
  "Auditing regional transaction flows...",
  "Running correlation matrix on item categories...",
  "Extracting seasonal patterns & sales velocity...",
  "Projecting inventory turnover and next-month demand curves...",
  "Consulting Gemini Business Analyst models...",
  "Formulating concrete executive recommendations..."
];

export default function AIInsightsPanel({ records }: AIInsightsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Rotate loading messages while fetching
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const generateInsights = async () => {
    if (records.length === 0) return;
    setLoading(true);
    setError(null);

    // Compute aggregated facts to send a highly precise summary to Gemini (conserves tokens and operates lightning-fast)
    const metrics = calculateMetrics(records);
    const timeline = getTimelineData(records);
    const categoryData = getCategoryData(records);
    const regionData = getRegionData(records);
    const productData = getProductData(records, 6);
    const storeData = getStoreLeaderboardData(records);

    try {
      const response = await fetch("/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrics,
          timeline,
          categoryData,
          regionData,
          productData,
          storeData,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to contact backend services.");
      }

      const data: AIResponse = await response.json();
      setInsights(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Please verify your Gemini API configuration.");
    } finally {
      setLoading(false);
    }
  };

  // Generate automatically once when records are loaded, if we don't have insights yet
  useEffect(() => {
    if (records.length > 0 && !insights && !loading && !error) {
      generateInsights();
    }
  }, [records]);

  const getInsightIcon = (type: AIInsight["type"]) => {
    switch (type) {
      case "positive":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-rose-500" />;
      case "opportunity":
        return <Lightbulb className="h-5 w-5 text-blue-500" />;
      default:
        return <Sparkles className="h-5 w-5 text-purple-500" />;
    }
  };

  const getInsightColor = (type: AIInsight["type"]) => {
    switch (type) {
      case "positive":
        return "bg-emerald-50/50 border-emerald-100 text-emerald-900";
      case "warning":
        return "bg-rose-50/50 border-rose-100 text-rose-900";
      case "opportunity":
        return "bg-blue-50/50 border-blue-100 text-blue-900";
      default:
        return "bg-purple-50/50 border-purple-100 text-purple-900";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">AI Sales Intelligence Agent</h2>
            <p className="text-[11px] text-slate-400 font-semibold">Automated executive reporting powered by Gemini 3.5</p>
          </div>
        </div>

        <button
          id="generate-insights-btn"
          onClick={generateInsights}
          disabled={loading || records.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {insights ? "Re-Analyze Dataset" : "Generate Intelligence Report"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading-state"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-slate-50/40 rounded-lg border border-slate-200/50"
          >
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <div className="space-y-1 max-w-sm px-4">
              <p className="text-xs font-bold text-slate-800">Processing Retail Intelligence</p>
              <p className="text-[11px] text-slate-400 h-5 font-mono">
                {LOADING_MESSAGES[loadingMsgIdx]}
              </p>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-rose-50 border border-rose-200 rounded-lg p-5 text-slate-800 text-sm space-y-2"
          >
            <div className="flex items-center gap-2 font-semibold text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              <span>Analytical Service Exception</span>
            </div>
            <p className="text-slate-600 text-xs">
              {error}
            </p>
            <p className="text-[10px] text-slate-400 font-medium pt-2">
              Please verify your Gemini API credentials in <b>Settings &gt; Secrets</b>.
            </p>
          </motion.div>
        ) : insights ? (
          <motion.div
            key="results-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left: Summary & Forecast (Cols 1) */}
            <div className="lg:col-span-1 space-y-6">
              {/* Executive Summary */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-5 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Executive Summary
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  {insights.summary}
                </p>
              </div>

              {/* Predictive Forecast */}
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Retail Demand Forecast
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                    <TrendingUp className="h-2.5 w-2.5" />
                    <span>Estimate</span>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#0F172A] tracking-tight">
                    ${insights.forecast.nextMonthEstimate?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">Next Month</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
                  <div className="space-y-0.5">
                    <div className="text-slate-400 font-bold text-[10px] uppercase">Trend Direction</div>
                    <div className="flex items-center gap-1 font-bold text-slate-700 capitalize">
                      {insights.forecast.trendDirection === "up" ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                      ) : insights.forecast.trendDirection === "down" ? (
                        <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      <span>{insights.forecast.trendDirection}</span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-slate-400 font-bold text-[10px] uppercase">Confidence Score</div>
                    <div className="font-bold text-slate-700 font-mono">
                      {insights.forecast.confidenceScore}%
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded border border-slate-150">
                  {insights.forecast.explanation}
                </p>
              </div>
            </div>

            {/* Right: Key Insights & Actions (Cols 2) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
                Anomalies & Strategic Opportunities
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col justify-between border rounded-lg p-5 transition-all hover:shadow-sm space-y-3 ${getInsightColor(
                      insight.type
                    )}`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex-shrink-0">{getInsightIcon(insight.type)}</div>
                        <h4 className="text-xs font-bold leading-tight text-[#0F172A]">{insight.title}</h4>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-95 font-semibold">
                        {insight.description}
                      </p>
                    </div>

                    <div className="bg-white rounded p-2.5 border border-slate-100 space-y-1">
                      <div className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">
                        Strategic Action Item
                      </div>
                      <p className="text-[10px] leading-normal font-bold text-blue-700">
                        {insight.actionableStep}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-slate-50/30 rounded-lg border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-500">AI Intelligence Report Ready</p>
            <p className="text-[11px] text-slate-400 max-w-sm">
              Press the button to analyze and synthesize customized insights from the currently filtered dataset.
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
