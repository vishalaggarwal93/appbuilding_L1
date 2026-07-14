import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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
