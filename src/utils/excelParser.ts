import * as XLSX from "xlsx";
import { SalesRecord } from "../types";
import { enrichRecord } from "../sampleData";

// Dynamic mapper to identify and align uploaded spreadsheet headers with the expected database schema
export function parseExcelOrCsv(file: File): Promise<SalesRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("Could not read file data.");
        }

        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse as raw JSON array of objects
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);

        if (!rawRows || rawRows.length === 0) {
          throw new Error("The uploaded spreadsheet seems to be empty.");
        }

        // Map raw headers intelligently
        const parsedRecords: SalesRecord[] = rawRows.map((row, index) => {
          const keys = Object.keys(row);
          
          // Matching helpers (case-insensitive, space-insensitive, with exclusions)
          const matchHeader = (includes: string[], excludes: string[] = []): string | undefined => {
            return keys.find(k => {
              const lk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
              const hasInclude = includes.some(inc => lk.includes(inc));
              const hasExclude = excludes.some(exc => lk.includes(exc));
              return hasInclude && !hasExclude;
            });
          };

          const getValue = (includes: string[], excludes: string[] = [], defaultVal: any = undefined) => {
            const key = matchHeader(includes, excludes);
            return key ? row[key] : defaultVal;
          };

          // 1. Date
          let rawDate = getValue(["date", "time", "day", "orderdate", "transdate"], ["update", "birth"], "2026-01-01");
          let dateStr = "2026-01-01";
          if (typeof rawDate === "number") {
            // Excel serial date representation
            try {
              const parsedDate = XLSX.SSF.parse_date_code(rawDate);
              const pad = (n: number) => String(n).padStart(2, "0");
              dateStr = `${parsedDate.y}-${pad(parsedDate.m)}-${pad(parsedDate.d)}`;
            } catch {
              dateStr = "2026-01-01";
            }
          } else if (rawDate) {
            // Clean up string date
            const dateObj = new Date(rawDate);
            if (!isNaN(dateObj.getTime())) {
              const pad = (n: number) => String(n).padStart(2, "0");
              dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
            }
          }

          // 2. Category
          const category = String(getValue(["category", "dept", "department", "group"], [], "General"));

          // 3. Product
          const product = String(getValue(["product", "item", "sku", "desc", "description", "name"], ["store", "customer", "client", "brand", "vendor", "buyer", "user", "city", "format", "region"], "Product Item"));

          // 4. Sales
          const rawSales = getValue(["sales", "revenue", "amount", "total", "price", "sale"], ["target", "goal", "budget", "forecast", "return", "refund", "discount", "markdown", "profit", "margin", "cost", "tax", "qty", "quantity", "id"], 0);
          const sales = typeof rawSales === "number" ? rawSales : parseFloat(String(rawSales).replace(/[^0-9.-]/g, "")) || 0;

          // 5. Quantity
          const rawQty = getValue(["qty", "quantity", "units", "count", "volume"], ["price", "amount", "sales", "id"], 1);
          const quantity = typeof rawQty === "number" ? rawQty : parseInt(String(rawQty).replace(/[^0-9-]/g, "")) || 1;

          // 6. Profit / Margin percentage
          const rawProfit = getValue(["profit", "margin", "earnings", "net", "income"], ["gross", "sales", "revenue", "target"], null);
          let profit = 0;
          if (rawProfit !== null) {
            profit = typeof rawProfit === "number" ? rawProfit : parseFloat(String(rawProfit).replace(/[^0-9.-]/g, "")) || 0;
            // If it seems to be a percentage profit margin (e.g., 0.40) rather than dollar amount, multiply by sales
            if (profit > 0 && profit < 1.0) {
              profit = sales * profit;
            }
          } else {
            // Estimate standard 35% margin if profit isn't present
            profit = sales * 0.35;
          }

          // 7. Region
          const region = String(getValue(["region", "zone", "state", "country"], ["city", "store", "format", "town"], "East"));

          // 8. Customer Segment
          const segment = String(getValue(["segment", "customer", "type", "audience", "channel"], [], "Consumer"));

          // Extra Columns for Advanced Retail Dashboard (optional)
          const returnAmount = getValue(["returnamount", "return", "returns", "refund", "refunds"], ["rate", "pct", "percent"]);
          const discountAmount = getValue(["discountamount", "discount", "markdown", "discounts", "markdowns"], ["rate", "pct", "percent"]);
          const targetSales = getValue(["targetsales", "target", "targets", "goal", "goals", "budget"], ["achievement", "rate", "pct", "percent"]);
          
          // Smart Store & Store ID matching
          const store = getValue(["store", "storename", "outlet", "outletname"], ["id", "code", "num", "no", "key", "format", "city", "region"]);
          const storeId = getValue(["storeid", "storecode", "storenum", "outletid", "storeno"]);
          const city = getValue(["city", "town", "citylocation"]);
          const storeFormat = getValue(["storeformat", "format"]);
          
          // 9. Week / Week start date (exclude orderdate or transdate, but allow matching week_start_date)
          const rawWeek = getValue(["week", "wk", "weekly"], ["orderdate", "transdate", "salesdate"]);
          let week: string | undefined = undefined;
          if (rawWeek !== undefined && rawWeek !== null && rawWeek !== "") {
            if (typeof rawWeek === "number") {
              // It could be a simple week number or an Excel serial date code
              if (rawWeek > 100) {
                try {
                  const parsedDate = XLSX.SSF.parse_date_code(rawWeek);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  week = `${pad(parsedDate.d)}-${pad(parsedDate.m)}-${parsedDate.y}`;
                } catch {
                  week = String(rawWeek);
                }
              } else {
                week = `Week ${rawWeek}`;
              }
            } else if (rawWeek instanceof Date) {
              const pad = (n: number) => String(n).padStart(2, "0");
              week = `${pad(rawWeek.getDate())}-${pad(rawWeek.getMonth() + 1)}-${rawWeek.getFullYear()}`;
            } else {
              const weekStr = String(rawWeek).trim();
              // If it's formatted as YYYY-MM-DD or similar date string
              const dateObj = new Date(weekStr);
              if (!isNaN(dateObj.getTime()) && weekStr.includes("-") && weekStr.split("-")[0].length === 4) {
                const pad = (n: number) => String(n).padStart(2, "0");
                week = `${pad(dateObj.getDate())}-${pad(dateObj.getMonth() + 1)}-${dateObj.getFullYear()}`;
              } else {
                week = weekStr;
              }
            }
          }

          const stockLevel = getValue(["stocklevel", "inventory", "stock", "qtyonhand"], ["sold", "out", "risk"]);

          const rawData = {
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

          return enrichRecord(rawData, index);
        });

        resolve(parsedRecords);
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("File reading failed. Please ensure the file is not corrupted."));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Generate Excel templates dynamically to let the user download and populate them
export function downloadTemplate() {
  const wsData = [
    ["Date", "Category", "Product", "Sales", "Quantity", "Profit", "Region", "Segment", "Store", "City", "Store Format", "Target Sales", "Stock Level", "Return Amount"],
    ["2026-07-01", "Electronics", "Ultra Charger", 120.00, 3, 48.00, "East", "Consumer", "Flagship Store NY", "New York", "Flagship", 130, 80, 0],
    ["2026-07-02", "Apparel", "Sport Socks", 25.00, 5, 10.00, "West", "Corporate", "Boutique West LA", "Los Angeles", "Boutique", 20, 15, 5],
    ["2026-07-03", "Home & Kitchen", "Silicone Spatula Set", 45.00, 2, 13.50, "North", "Home Office", "Metro Express Chicago", "Chicago", "Express", 50, 45, 0],
    ["2026-07-04", "Beauty & Personal Care", "Organic Clay Mask", 80.00, 4, 40.00, "South", "Consumer", "Hub South Miami", "Miami", "Boutique", 75, 10, 8],
    ["2026-07-05", "Electronics", "Wireless Travel Mouse", 210.00, 6, 84.00, "West", "Corporate", "Digital Store Online", "Seattle", "Online", 200, 12, 0]
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sales Template");

  XLSX.writeFile(wb, "Retail_Sales_Intelligence_Template.xlsx");
}
