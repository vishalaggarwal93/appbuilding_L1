import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { spawn, execSync } from "child_process";
import http from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { SAMPLE_SALES_DATA, enrichRecord } from "./src/sampleData";

dotenv.config();

const app = express();
const PORT = 3000;

let usePython = false;

// Fall through directly to native Node.js route handlers
app.all("/api/python/*", (req, res, next) => {
  return next();
});

// Disabled Python Backend Process to use the extremely robust Node.js XLSX/CSV parser instead
let pythonBackend: any = null;


process.on("exit", () => {
  if (pythonBackend) {
    pythonBackend.kill();
  }
});

// Node.js fallback implementation for Python API routes (runs if Python is missing/fails to spawn)
app.get("/api/python/initial-data", (req, res) => {
  res.json({
    status: "success",
    records: SAMPLE_SALES_DATA
  });
});

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/python/parse", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file selected" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Parse as raw rows (array of arrays)
    const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (!rawRows || rawRows.length < 2) {
      return res.json({
        status: "success",
        filename: req.file.originalname,
        records: []
      });
    }

    const headers = rawRows[0].map((h: any) => h !== undefined && h !== null ? String(h).trim() : "");
    const dataRows = rawRows.slice(1);
    
    const cleanHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    const matchHeader = (includes: string[], excludes: string[] = []): number => {
      for (let idx = 0; idx < headers.length; idx++) {
        const ch = cleanHeader(headers[idx]);
        const hasInclude = includes.some(inc => ch.includes(inc));
        const hasExclude = excludes.some(exc => ch.includes(exc));
        if (hasInclude && !hasExclude) {
          return idx;
        }
      }
      return -1;
    };

    const dateIdx = matchHeader(["date", "time", "day", "orderdate", "transdate"], ["update", "birth"]);
    const categoryIdx = matchHeader(["category", "dept", "department", "group"]);
    const productIdx = matchHeader(["product", "item", "sku", "desc", "description", "name"], ["store", "customer", "client", "brand", "vendor", "buyer", "user", "city", "format", "region"]);
    const salesIdx = matchHeader(["sales", "revenue", "amount", "total", "price", "sale"], ["target", "goal", "budget", "forecast", "return", "refund", "discount", "markdown", "profit", "margin", "cost", "tax", "qty", "quantity", "id"]);
    const qtyIdx = matchHeader(["qty", "quantity", "units", "count", "volume"], ["price", "amount", "sales", "id"]);
    const profitIdx = matchHeader(["profit", "margin", "earnings", "net", "income"], ["gross", "sales", "revenue", "target"]);
    const regionIdx = matchHeader(["region", "zone", "state", "country"], ["city", "store", "format", "town"]);
    const segmentIdx = matchHeader(["segment", "customer", "type", "audience", "channel"]);
    const returnIdx = matchHeader(["returnamount", "return", "returns", "refund", "refunds"], ["rate", "pct", "percent"]);
    const discountIdx = matchHeader(["discountamount", "discount", "markdown", "discounts", "markdowns"], ["rate", "pct", "percent"]);
    const targetIdx = matchHeader(["targetsales", "target", "targets", "goal", "goals", "budget"], ["achievement", "rate", "pct", "percent"]);
    const storeIdx = matchHeader(["store", "storename", "outlet", "outletname"], ["id", "code", "num", "no", "key", "format", "city", "region"]);
    const storeid_idx = matchHeader(["storeid", "storecode", "storenum", "outletid", "storeno"]);
    const city_idx = matchHeader(["city", "town", "citylocation"]);
    const format_idx = matchHeader(["storeformat", "format"]);
    const week_idx = matchHeader(["week", "wk", "weekly"], ["orderdate", "transdate", "salesdate"]);
    const stock_idx = matchHeader(["stocklevel", "inventory", "stock", "qtyonhand"], ["sold", "out", "risk"]);

    const records: any[] = [];

    for (let index = 0; index < dataRows.length; index++) {
      const r = dataRows[index];
      if (!r || r.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === "")) {
        continue;
      }

      const getVal = (idx: number, defaultVal: any = undefined) => {
        if (idx !== -1 && idx < r.length && r[idx] !== undefined && r[idx] !== null) {
          return r[idx];
        }
        return defaultVal;
      };

      const product = String(getVal(productIdx, "Product Item")).trim();
      if (!product || ["product item", "product"].includes(product.toLowerCase())) {
        continue;
      }

      const rawDate = getVal(dateIdx, "2026-01-01");
      let dateStr = "2026-01-01";
      if (typeof rawDate === "number") {
        try {
          const parsedDate = XLSX.SSF.parse_date_code(rawDate);
          const pad = (n: number) => String(n).padStart(2, "0");
          dateStr = `${parsedDate.y}-${pad(parsedDate.m)}-${pad(parsedDate.d)}`;
        } catch {
          dateStr = "2026-01-01";
        }
      } else if (rawDate) {
        const rawDateStr = String(rawDate).trim();
        const splitDate = rawDateStr.split("T")[0];
        const dateObj = new Date(splitDate);
        if (!isNaN(dateObj.getTime())) {
          const pad = (n: number) => String(n).padStart(2, "0");
          dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
        }
      }

      const category = String(getVal(categoryIdx, "General"));
      const rawSales = getVal(salesIdx, 0);
      let sales = 0;
      if (typeof rawSales === "number") {
        sales = rawSales;
      } else {
        sales = parseFloat(String(rawSales).replace(/[^0-9.-]/g, "")) || 0;
      }

      const rawQty = getVal(qtyIdx, 1);
      let quantity = 1;
      if (typeof rawQty === "number") {
        quantity = rawQty;
      } else {
        quantity = parseInt(String(rawQty).replace(/[^0-9-]/g, "")) || 1;
      }

      const rawProfit = getVal(profitIdx, null);
      let profit = sales * 0.35;
      if (rawProfit !== null) {
        if (typeof rawProfit === "number") {
          profit = rawProfit;
        } else {
          profit = parseFloat(String(rawProfit).replace(/[^0-9.-]/g, "")) || 0;
        }
        if (profit > 0 && profit < 1.0) {
          profit = sales * profit;
        }
      }

      const region = String(getVal(regionIdx, "East"));
      const segment = String(getVal(segmentIdx, "Consumer"));

      const returnAmount = getVal(returnIdx, null);
      const discountAmount = getVal(discountIdx, null);
      const targetSales = getVal(targetIdx, null);
      const store = getVal(storeIdx, null);
      const storeId = getVal(storeid_idx, null);
      const city = getVal(city_idx, null);
      const storeFormat = getVal(format_idx, null);
      const stockLevel = getVal(stock_idx, null);

      const rawWeek = getVal(week_idx, null);
      let week: string | undefined = undefined;
      if (rawWeek !== null) {
        if (typeof rawWeek === "number" && rawWeek > 100) {
          try {
            const parsedDate = XLSX.SSF.parse_date_code(rawWeek);
            const pad = (n: number) => String(n).padStart(2, "0");
            week = `${pad(parsedDate.d)}-${pad(parsedDate.m)}-${parsedDate.y}`;
          } catch {
            week = String(rawWeek);
          }
        } else {
          week = String(rawWeek).trim();
        }
      }

      const rawRecord = {
        id: `uploaded-${index}-${Date.now()}`,
        date: dateStr,
        category,
        product,
        sales,
        quantity,
        profit,
        region,
        segment,
        returnAmount,
        discountAmount,
        targetSales,
        store,
        storeId,
        city,
        storeFormat,
        week,
        stockLevel
      };

      records.push(enrichRecord(rawRecord, index));
    }

    res.json({
      status: "success",
      filename: req.file.originalname,
      records
    });
  } catch (error: any) {
    console.error("Error parsing Excel in Node fallback:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.use(express.json({ limit: "50mb" }));

// Lazy initializer for Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment. Please verify your settings.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// 1. Endpoint: Generate Automated Sales Insights & Structured Recommendations
app.post("/api/generate-insights", async (req, res) => {
  try {
    const { metrics, timeline, categoryData, regionData, productData, storeData } = req.body;

    // Check if Gemini API key is defined. If not, generate high-quality dynamic mock responses to prevent application crashes
    if (!process.env.GEMINI_API_KEY) {
      const topCat = categoryData?.[0]?.category || "Apparel";
      const topReg = regionData?.[0]?.region || "North America";
      const totalNet = metrics.netSales || 0;
      const margin = metrics.netSales ? ((metrics.totalProfit / metrics.netSales) * 100).toFixed(1) : "0";

      let laggingStoreName = "Boutique West LA";
      let laggingStoreId = "STR-102";
      if (storeData && storeData.length > 0) {
        const sortedStores = [...storeData].sort((a: any, b: any) => a.achievement - b.achievement);
        if (sortedStores[0]) {
          laggingStoreName = sortedStores[0].store;
          laggingStoreId = sortedStores[0].storeId;
        }
      }

      const fallbackResponse = {
        summary: `Performance is solid with net sales totaling $${totalNet.toLocaleString()} and an aggregate profit margin of ${margin}%. Retail division category "${topCat}" and operating region "${topReg}" remain the primary anchors of top-line revenue and profitability. [Demo Mode: Configure GEMINI_API_KEY in Settings to activate real Gemini analysis]`,
        insights: [
          {
            title: `Revenue Champion: ${topCat}`,
            type: "positive",
            description: `Merchandising analysis identifies "${topCat}" as the leading category, sustaining strong volume turn rates and representing the primary cash flow driver.`,
            actionableStep: "Allocate promotional priority and increase inventory depth for high-margin SKU items in this segment to support momentum."
          },
          {
            title: "Operating Margin Optimization",
            type: "warning",
            description: `Store metrics indicate lagging achievement ratios in "${laggingStoreName}" (Backend ID: ${laggingStoreId}). Promotional markdowns and returned merchandise values are adding downward pressure on margin targets in this specific location.`,
            actionableStep: `Optimize return window parameters and review localized pricing strategies at store ${laggingStoreId} to protect bottom-line yields.`
          },
          {
            title: `Territorial Growth: ${topReg}`,
            type: "opportunity",
            description: `Aggregated data highlights robust transaction counts and elevated customer spend values within the "${topReg}" operating division.`,
            actionableStep: "Expand product selection and direct regional logistics support to avoid out-of-stock events on premium lines."
          }
        ],
        forecast: {
          nextMonthEstimate: Math.round(totalNet * 1.05),
          trendDirection: "up",
          confidenceScore: 85,
          explanation: `Predictive model assumes a 5.0% baseline increase driven by seasonal velocity and stable average transaction values of $${(metrics.averageTransactionValue || 0).toFixed(2)} across key store formats.`
        }
      };
      return res.json(fallbackResponse);
    }

    const client = getGeminiClient();

    const prompt = `
      Analyze the following aggregated retail sales data and provide structured business intelligence.
      
      OVERALL RETAIL PERFORMANCE METRICS:
      - Gross Sales: $${metrics.grossSales?.toLocaleString() ?? "0"}
      - Net Realized Sales: $${metrics.netSales?.toLocaleString() ?? "0"}
      - Total Units Sold: ${metrics.totalQuantity?.toLocaleString() ?? "0"}
      - Total Profit Yield: $${metrics.totalProfit?.toLocaleString() ?? "0"}
      - Average Profit Margin: ${(metrics.averageMargin * 100)?.toFixed(1) ?? "0"}%
      - Average Transaction Value (ATV): $${metrics.averageTransactionValue?.toFixed(2) ?? "0"}
      - Corporate Sales Target: $${metrics.targetSales?.toLocaleString() ?? "0"}
      - Overall Target Achievement Rate: ${metrics.targetAchievement?.toFixed(1) ?? "0"}%
      - Returned Merchandise Value: $${metrics.totalReturnAmount?.toLocaleString() ?? "0"}
      - Average Return Rate: ${metrics.returnRate?.toFixed(2) ?? "0"}%
      - Total Markdown Discounts: $${metrics.totalDiscountAmount?.toLocaleString() ?? "0"}
      - Average Discount Rate: ${metrics.averageDiscountRate?.toFixed(1) ?? "0"}%
      
      WEEKLY & MONTHLY TREND (TIMELINE):
      ${JSON.stringify(timeline, null, 2)}
      
      CATEGORY PERFORMANCE:
      ${JSON.stringify(categoryData, null, 2)}
      
      REGIONAL BREAKDOWN:
      ${JSON.stringify(regionData, null, 2)}
      
      STORE PERFORMANCE & CORRESPONDING BACKEND STORE IDs (FOR CALCULATIONS):
      ${JSON.stringify(storeData, null, 2)}
      
      TOP PERFORMING PRODUCTS (BY REVENUE):
      ${JSON.stringify(productData, null, 2)}
      
      Task:
      1. Deliver an elegant, professional retail executive summary. Specifically mention core indicators such as Net Sales, Return Rates, Target Achievements, and Discount Markdowns.
      2. Identify 3 to 4 high-value business insights. You MUST explicitly analyze and address:
         - Territorial analysis highlighting the best and worst performing operating regions.
         - Outlets/stores lagging or missing target goals (referencing their corresponding backend store IDs, e.g. STR-101).
         - Merchandising risk highlighting high return product categories with return rate percentages.
         - For each insight, categorize it (positive, warning, or opportunity) and provide a concrete actionable step.
      3. Create a calculated quantitative estimate/forecast for the next calendar month, indicate the trend direction (up, down, flat), state your confidence level, and explain your logical reasoning based on seasonality, velocity, and segment behavior.
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite Retail Revenue Officer and Sales Intelligence Specialist. Analyze retail data with precision, call out concrete anomalies or triumphs, and suggest direct corporate action items.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "An executive overview summarizing the state of the retail business."
            },
            insights: {
              type: Type.ARRAY,
              description: "High-value business findings with strategic next steps.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { 
                    type: Type.STRING, 
                    description: "Must be exactly one of: positive, warning, neutral, or opportunity" 
                  },
                  description: { type: Type.STRING },
                  actionableStep: { type: Type.STRING, description: "A precise, concrete business tactic to resolve or capitalize on this insight." }
                },
                required: ["title", "type", "description", "actionableStep"]
              }
            },
            forecast: {
              type: Type.OBJECT,
              properties: {
                nextMonthEstimate: { type: Type.NUMBER, description: "Revenue forecast for the upcoming month." },
                trendDirection: { type: Type.STRING, description: "One of: up, down, flat" },
                confidenceScore: { type: Type.NUMBER, description: "Confidence level between 0 and 100." },
                explanation: { type: Type.STRING, description: "Analytical logic supporting this forecast." }
              },
              required: ["nextMonthEstimate", "trendDirection", "confidenceScore", "explanation"]
            }
          },
          required: ["summary", "insights", "forecast"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini.");
    }

    res.json(JSON.parse(text.trim()));
  } catch (error: any) {
    console.error("Error generating insights:", error);
    res.status(500).json({ 
      error: "Failed to generate sales insights.", 
      message: error.message 
    });
  }
});

// 2. Endpoint: Interactive Business Chat Assistant
app.post("/api/chat-assistant", async (req, res) => {
  try {
    const { messages, datasetSummary } = req.body;

    // Check if Gemini API key is defined. If not, generate a helpful dynamic fallback chat answer
    if (!process.env.GEMINI_API_KEY) {
      const userMessage = messages[messages.length - 1]?.content || "";
      let reply = "";

      const query = userMessage.toLowerCase();
      if (query.includes("category") || query.includes("product") || query.includes("item")) {
        reply = `Analyzing product category metrics:
        
• Your leading merchandising lines are: **${datasetSummary.topCategories?.[0] || 'Apparel'}**.
• Average profit margin across all categories stands at **${(datasetSummary.averageMargin * 100)?.toFixed(1) ?? "0"}%**.

**Strategic Suggestion**: Focus inventory placement on top performing items in **${datasetSummary.topCategories?.[0] || 'the main category'}** to capture high turn velocity.

*(Running in Demo Mode. To enable custom Gemini replies, please set GEMINI_API_KEY in Settings > Secrets)*`;
      } else if (query.includes("region") || query.includes("territory") || query.includes("city") || query.includes("store")) {
        reply = `Reviewing operating locations & channels:
        
• The highest performing operating territory is **${datasetSummary.regions?.[0] || 'North America'}**.
• Net sales volume for active stores is **$${datasetSummary.totalSales?.toLocaleString() ?? "0"}** across **${datasetSummary.totalQuantity?.toLocaleString() ?? "0"}** unit transactions.

**Operational Focus**: Review logistics pipelines and inventory density for **${datasetSummary.regions?.[0] || 'primary regions'}** to secure consistent product availability.

*(Running in Demo Mode. To enable custom Gemini replies, please set GEMINI_API_KEY in Settings > Secrets)*`;
      } else if (query.includes("swot") || query.includes("analysis") || query.includes("strategy")) {
        reply = `Here is a custom business SWAT analysis based on active retail indicators:

• **Strengths**: Robust net sales of **$${datasetSummary.totalSales?.toLocaleString() ?? "0"}** with overall margins of **${(datasetSummary.averageMargin * 100)?.toFixed(1) ?? "0"}%**.
• **Weaknesses**: Markdowns/promotions and returned stock trimming gross revenue potential.
• **Opportunities**: Scaling up regional centers like **${datasetSummary.regions?.[0] || 'primary regions'}**.
• **Threats**: Understock risks on high-turn product lines.

*(Running in Demo Mode. To enable custom Gemini replies, please set GEMINI_API_KEY in Settings > Secrets)*`;
      } else {
        reply = `Thank you for your inquiry! Here is a summary of active retail performance metrics:

• **Net Sales Volume**: $${datasetSummary.totalSales?.toLocaleString() ?? "0"}
• **Aggregate Profit**: $${datasetSummary.totalProfit?.toLocaleString() ?? "0"}
• **Average Unit Margin**: ${(datasetSummary.averageMargin * 100)?.toFixed(1) ?? "0"}%
• **Leading Merchandising Segments**: ${datasetSummary.topCategories?.slice(0, 2).join(", ") || "Main lines"}

Ask me more about specific category margin adjustments, regional SWOT elements, or store volume strategies!

*(Running in Demo Mode. To enable custom Gemini replies, please set GEMINI_API_KEY in Settings > Secrets)*`;
      }

      return res.json({ reply });
    }

    const client = getGeminiClient();

    // Inject data summary context in the system instruction / greeting
    const systemPrompt = `
      You are an interactive Retail Sales Intelligence Assistant. 
      You have access to the business's current sales data summary below. Keep answers direct, professional, and full of useful business terms. Use bullet points and bold formatting where appropriate.
      
      CURRENT DATASET SUMMARY:
      - Total Net Sales: $${datasetSummary.totalSales?.toLocaleString() ?? "0"}
      - Total Units Sold: ${datasetSummary.totalQuantity?.toLocaleString() ?? "0"}
      - Total Profit: $${datasetSummary.totalProfit?.toLocaleString() ?? "0"}
      - Average Margin: ${(datasetSummary.averageMargin * 100)?.toFixed(1) ?? "0"}%
      - Top Categories: ${JSON.stringify(datasetSummary.topCategories ?? [])}
      - Top regions: ${JSON.stringify(datasetSummary.regions ?? [])}
      
      Always focus on answering the user's specific questions regarding retail metrics, trends, margin improvements, inventory allocation, or regional strategies.
    `;

    // Map the incoming chat messages into the structure required by Gemini SDK
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Error in chat assistant:", error);
    res.status(500).json({ 
      error: "Assistant error.", 
      message: error.message 
    });
  }
});

// Vite Middleware & Production SPA serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

setupServer();
