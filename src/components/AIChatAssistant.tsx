import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Trash2, HelpCircle, Loader2 } from "lucide-react";
import { SalesRecord } from "../types";
import { calculateMetrics, getCategoryData, getRegionData, getProductData, getStoreLeaderboardData } from "../utils/metrics";
import { motion, AnimatePresence } from "motion/react";

interface AIChatAssistantProps {
  records: SalesRecord[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SAMPLE_QUESTIONS = [
  "Which category has the highest profit margin and why?",
  "Give me a regional performance breakdown and SWOT analysis.",
  "Identify products we should promote further to maximize margins.",
  "Suggest 3 immediate tactics to increase average order values."
];

export default function AIChatAssistant({ records }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your AI Sales Intelligence Assistant. Ask me anything about your current dataset—such as which categories are lagging, regional opportunities, or margin optimization tactics!"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Compute active dataset summary to send as light context to Gemini
    const metrics = calculateMetrics(records);
    const categoryData = getCategoryData(records).slice(0, 4);
    const regionData = getRegionData(records);
    const productData = getProductData(records, 5);
    const storeData = getStoreLeaderboardData(records).slice(0, 4);

    const datasetSummary = {
      totalSales: metrics.netSales,
      totalProfit: metrics.totalProfit,
      totalQuantity: metrics.totalQuantity,
      averageMargin: metrics.averageMargin,
      topCategories: categoryData.map(c => `${c.category} (Sales: $${c.sales}, Margin: ${c.margin.toFixed(0)}%)`),
      regions: regionData.map(r => `${r.region} (Sales: $${r.sales})`),
      topProducts: productData.map(p => p.product),
      topStores: storeData.map(s => `${s.store} [ID: ${s.storeId}] (Sales: $${s.netSales}, Target Achieved: ${s.achievement}%)`)
    };

    try {
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content
          })),
          datasetSummary
        })
      });

      if (!response.ok) {
        throw new Error("Assistant is currently unresponsive. Please check connection.");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ **Error**: ${err.message || "Failed to fetch response."} Please ensure your Gemini API secrets are set.` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared! What other insights can I help you extract from this retail data?"
      }
    ]);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden">
      {/* Header */}
      <div className="bg-[#0F172A] px-5 py-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-wide">Interactive Diagnostic Chat</h3>
            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider leading-none mt-0.5">● Assistant Online</p>
          </div>
        </div>

        {messages.length > 1 && (
          <button
            onClick={clearChat}
            className="text-slate-400 hover:text-white transition-colors p-1"
            title="Clear Conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div className={`p-1.5 rounded flex-shrink-0 ${
              m.role === "user" ? "bg-slate-900 text-white" : "bg-blue-50 text-blue-700 border border-blue-100"
            }`}>
              {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>

            <div className={`text-xs max-w-[80%] rounded-lg px-4 py-2.5 shadow-sm leading-relaxed ${
              m.role === "user" 
                ? "bg-slate-800 text-white rounded-tr-none" 
                : "bg-white text-slate-700 border border-slate-200 rounded-tl-none font-semibold whitespace-pre-wrap"
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 text-slate-400 text-xs">
            <div className="p-1.5 rounded bg-blue-50 border border-blue-150 text-blue-600 flex-shrink-0 animate-spin">
              <Loader2 className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold animate-pulse">Assistant is compiling answers...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer input and suggestions */}
      <div className="p-4 bg-white border-t border-slate-200 space-y-3">
        {messages.length === 1 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Suggested Analytical Questions</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-left text-[10px] font-bold text-slate-600 bg-[#F1F5F9] hover:bg-slate-200 hover:text-slate-800 border border-slate-200 p-2 rounded transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask AI Sales Assistant..."
            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-700 font-semibold"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-[#3B82F6] hover:bg-blue-700 text-white rounded disabled:opacity-45 transition-colors shadow-sm flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
