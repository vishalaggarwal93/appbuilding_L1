import * as XLSX from "xlsx";
import { SalesRecord } from "../types";
import { enrichRecord } from "../sampleData";

// Dynamic mapper to identify and align uploaded spreadsheet headers with the expected database schema
export async function parseExcelOrCsv(file: File): Promise<SalesRecord[]> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/python/parse", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to parse Excel file via Python API (HTTP ${response.status})`);
  }

  const result = await response.json();
  if (result.status === "error") {
    throw new Error(result.message || "Failed to parse Excel file via Python backend.");
  }

  return result.records;
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
