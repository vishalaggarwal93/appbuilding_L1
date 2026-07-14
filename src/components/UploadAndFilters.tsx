import React, { useState, useRef, useMemo } from "react";
import { Upload, Download, RefreshCw, Search, X, Filter, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { parseExcelOrCsv, downloadTemplate } from "../utils/excelParser";
import { SalesRecord, DashboardFilters } from "../types";
import { getRegionData, getCategoryData, getStoreLeaderboardData } from "../utils/metrics";
import DropdownFilter from "./DropdownFilter";

interface UploadedFile {
  id: string;
  name: string;
  recordCount: number;
  records: SalesRecord[];
}

interface StoreDetail {
  id: string;
  name: string;
  city: string;
  region: string;
  storeFormat: string;
}

interface UploadAndFiltersProps {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  onDataLoaded: (files: { name: string; records: SalesRecord[] }[]) => void;
  onResetData: () => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (id: string) => void;
  availableCategories: string[];
  availableRegions: string[];
  availableSegments: string[];
  availableWeeks: string[];
  availableStores: string[];
  availableCities: string[];
  availableStoreFormats: string[];
  filteredRecords: SalesRecord[];
  salesRecords: SalesRecord[];
}

export default function UploadAndFilters({
  filters,
  setFilters,
  onDataLoaded,
  onResetData,
  uploadedFiles,
  onRemoveFile,
  availableCategories,
  availableRegions,
  availableSegments,
  availableWeeks,
  availableStores,
  availableCities,
  availableStoreFormats,
  filteredRecords,
  salesRecords,
}: UploadAndFiltersProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate relational store detail mapping dynamically from active dataset
  const storeDetailsList = useMemo<StoreDetail[]>(() => {
    const map = new Map<string, StoreDetail>();
    salesRecords.forEach((r, idx) => {
      if (!r.store) return;
      if (!map.has(r.store)) {
        let id = "";
        if (r.store === "Flagship Store NY") id = "STR-101";
        else if (r.store === "Boutique West LA") id = "STR-102";
        else if (r.store === "Metro Express Chicago") id = "STR-103";
        else if (r.store === "Digital Store Online") id = "STR-104";
        else if (r.store === "Hub South Miami") id = "STR-105";
        else if (r.store === "Core North Boston") id = "STR-106";
        else {
          id = `STR-${101 + map.size}`;
        }
        map.set(r.store, {
          id,
          name: r.store,
          city: r.city || "Unknown City",
          region: r.region || "Unknown Region",
          storeFormat: r.storeFormat || "Standard",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [salesRecords]);

  // CENTRALIZED handler for interconnected store-related selections
  const handleStoreInterconnection = (field: "stores" | "cities" | "regions" | "storeFormats", values: string[]) => {
    setFilters((prev) => {
      const nextFilters = { ...prev };

      if (values.length === 0) {
        // When clearing a filter, reset all interconnected store filters to empty
        nextFilters.stores = [];
        nextFilters.cities = [];
        nextFilters.regions = [];
        nextFilters.storeFormats = [];
      } else {
        nextFilters[field] = values;

        // Auto-selection linkages
        if (field === "stores") {
          const matched = storeDetailsList.filter(s => values.includes(s.name));
          nextFilters.regions = Array.from(new Set(matched.map(s => s.region)));
          nextFilters.cities = Array.from(new Set(matched.map(s => s.city)));
          nextFilters.storeFormats = Array.from(new Set(matched.map(s => s.storeFormat)));
        } else if (field === "cities") {
          const matched = storeDetailsList.filter(s => values.includes(s.city));
          nextFilters.regions = Array.from(new Set(matched.map(s => s.region)));
          nextFilters.storeFormats = Array.from(new Set(matched.map(s => s.storeFormat)));
          nextFilters.stores = Array.from(new Set(matched.map(s => s.name)));
        } else if (field === "regions") {
          const matched = storeDetailsList.filter(s => values.includes(s.region));
          nextFilters.cities = Array.from(new Set(matched.map(s => s.city)));
          nextFilters.storeFormats = Array.from(new Set(matched.map(s => s.storeFormat)));
          nextFilters.stores = Array.from(new Set(matched.map(s => s.name)));
        } else if (field === "storeFormats") {
          const matched = storeDetailsList.filter(s => values.includes(s.storeFormat));
          nextFilters.regions = Array.from(new Set(matched.map(s => s.region)));
          nextFilters.cities = Array.from(new Set(matched.map(s => s.city)));
          nextFilters.stores = Array.from(new Set(matched.map(s => s.name)));
        }
      }

      return nextFilters;
    });
  };


  const handleFiles = async (files: File[]) => {
    setErrorMsg(null);
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv")) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (invalidFiles.length > 0) {
      setErrorMsg(`Unsupported files ignored: ${invalidFiles.join(", ")}. Please upload Excel (.xlsx, .xls) or CSV files.`);
    }

    if (validFiles.length === 0) return;

    try {
      const loadedData: { name: string; records: SalesRecord[] }[] = [];
      for (const file of validFiles) {
        const records = await parseExcelOrCsv(file);
        loadedData.push({ name: file.name, records });
      }
      onDataLoaded(loadedData);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse files. Please verify their contents.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  // Multiple selection handlers
  const toggleFilter = (field: keyof DashboardFilters, value: string) => {
    setFilters((prev) => {
      const current = prev[field];
      if (Array.isArray(current)) {
        const active = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value];
        return { ...prev, [field]: active };
      }
      return prev;
    });
  };

  // Single dropdown select helpers (wrappers around array filters for UI space efficiency)
  const handleDropdownSelect = (field: keyof DashboardFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value ? [value] : [],
    }));
  };

  const resetFilters = () => {
    setFilters({
      dateRange: { start: "", end: "" },
      categories: [],
      regions: [],
      segments: [],
      searchQuery: "",
      weeks: [],
      stores: [],
      cities: [],
      storeFormats: [],
    });
  };

  // strategic calculations for insights text briefing
  const generateInsightsText = () => {
    if (filteredRecords.length === 0) return "No data available under active filters.";

    const regionStats = getRegionData(filteredRecords);
    const categoryStats = getCategoryData(filteredRecords);
    const storeStats = getStoreLeaderboardData(filteredRecords);

    const bestRegion = regionStats.length > 0 ? regionStats[0] : null;
    const worstRegion = regionStats.length > 1 ? regionStats[regionStats.length - 1] : null;

    const missingTargetStores = storeStats.filter((s) => s.achievement < 100);
    const highReturnCategories = categoryStats.filter((c) => c.returnRate > 8);

    const totalSales = filteredRecords.reduce((acc, curr) => acc + curr.sales, 0);
    const totalReturns = filteredRecords.reduce((acc, curr) => acc + (curr.returnAmount || 0), 0);
    const netSales = Math.max(0, totalSales - totalReturns);

    let brief = `RETAILMETRICS AI - STRATEGIC EXECUTIVE BRIEFING\n`;
    brief += `Generated: ${new Date().toLocaleString()}\n`;
    brief += `Scope: ${filteredRecords.length} Filtered Transactions\n`;
    if (uploadedFiles.length > 0) {
      brief += `Loaded Files:\n`;
      uploadedFiles.forEach((f, idx) => {
        brief += `  [${idx + 1}] ${f.name} (${f.recordCount.toLocaleString()} rows)\n`;
      });
    } else {
      brief += `Loaded Source: Standard Integrated Demo Dataset\n`;
    }
    brief += `==================================================\n\n`;

    brief += `1. FINANCIAL OVERVIEW\n`;
    brief += `--------------------------------------------------\n`;
    brief += `Gross Revenue: $${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    brief += `Returned Write-offs: $${totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    brief += `Net Realized Sales: $${netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;

    brief += `2. TERRITORIAL PERFORMANCE (BEST/WORST REGIONS)\n`;
    brief += `--------------------------------------------------\n`;
    if (bestRegion) {
      brief += `* LEADER REGION: ${bestRegion.region}\n`;
      brief += `  - Net Realized Sales: $${bestRegion.netSales.toLocaleString()}\n`;
      brief += `  - Net Profit Yield: $${bestRegion.profit.toLocaleString()}\n`;
    }
    if (worstRegion) {
      brief += `* LAGGARD REGION: ${worstRegion.region}\n`;
      brief += `  - Net Realized Sales: $${worstRegion.netSales.toLocaleString()}\n`;
      brief += `  - Net Profit Yield: $${worstRegion.profit.toLocaleString()}\n`;
    }
    brief += `\n`;

    brief += `3. OUTLETS MISSING PERFORMANCE TARGETS\n`;
    brief += `--------------------------------------------------\n`;
    if (missingTargetStores.length === 0) {
      brief += `* Excellent! All active stores have met or exceeded 100% of their sales targets.\n`;
    } else {
      brief += `The following ${missingTargetStores.length} stores are currently trailing their targets:\n`;
      missingTargetStores.forEach((store) => {
        const gap = store.targetSales - store.netSales;
        brief += `* ${store.store} (${store.city} - ${store.format})\n`;
        brief += `  - Realized: $${store.netSales.toLocaleString()} vs Target: $${store.targetSales.toLocaleString()}\n`;
        brief += `  - Achievement Deficit: ${store.achievement}% (Gap: $${gap.toLocaleString()})\n`;
      });
    }
    brief += `\n`;

    brief += `4. HIGH RETURN MERCHANDISE RISK CATEGORIES\n`;
    brief += `--------------------------------------------------\n`;
    if (highReturnCategories.length === 0) {
      brief += `* Return rates are stabilized across all categories (all below 8% threshold).\n`;
    } else {
      brief += `The following categories have elevated return rates exceeding the 8% target threshold:\n`;
      highReturnCategories.forEach((cat) => {
        brief += `* ${cat.category}\n`;
        brief += `  - Gross Sales: $${cat.sales.toLocaleString()} | Return Write-offs: $${cat.returns.toLocaleString()}\n`;
        brief += `  - Return Rate: ${cat.returnRate.toFixed(2)}% of Gross Revenue\n`;
      });
    }
    brief += `\n`;

    brief += `5. SYSTEM STRATEGIC RECOMS\n`;
    brief += `--------------------------------------------------\n`;
    if (missingTargetStores.length > 0) {
      brief += `- Allocate hyper-local promotional marketing budgets specifically to the ${missingTargetStores.length} lagging outlets.\n`;
    }
    if (highReturnCategories.length > 0) {
      brief += `- Conduct immediately audits of supply-chain quality and sizing charts for high-return items (especially within Apparel or Beauty).\n`;
    }
    brief += `- Prioritize restock scheduling for products identified with high risk-ratios in the inventory tracker.\n`;

    return brief;
  };

  // Download filtered data as CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      "ID", "Date", "Category", "Product", "Sales (Gross)", "Quantity", "Profit", 
      "Region", "Segment", "Store", "City", "Store Format", "Target Sales", 
      "Stock Level", "Return Amount", "Discount Amount", "Net Sales"
    ];
    
    const rows = filteredRecords.map(r => [
      r.id,
      r.date,
      r.category,
      r.product,
      r.sales,
      r.quantity,
      r.profit,
      r.region,
      r.segment,
      r.store,
      r.city,
      r.storeFormat,
      r.targetSales,
      r.stockLevel,
      r.returnAmount,
      r.discountAmount,
      Math.max(0, r.sales - r.returnAmount).toFixed(1)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RetailMetrics_Filtered_Sales_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Strategic Briefing as TXT file
  const handleExportStrategicTXT = () => {
    const text = generateInsightsText();
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `RetailMetrics_Strategic_Briefing_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Upload Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div
            id="drop-zone"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50/40"
                : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileSelect}
              className="hidden"
              accept=".xlsx,.xls,.csv"
              multiple
            />
            <Upload className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              {uploadedFiles.length > 0 ? (
                <span className="text-blue-600 font-bold">
                  {uploadedFiles.length === 1 
                    ? `1 Active Spreadsheet Loaded (Click to add more)` 
                    : `${uploadedFiles.length} Active Spreadsheets Loaded (Click to add more)`}
                </span>
              ) : (
                "Click to upload or drag & drop multiple Excel / CSV files"
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports loading multiple sheets. Additional files are seamlessly merged and tracked.
            </p>
            {errorMsg && (
              <p className="text-xs text-rose-500 font-medium mt-2 bg-rose-50 px-2.5 py-1 rounded">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Uploaded Files Inventory */}
          {uploadedFiles.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Loaded Files Inventory ({uploadedFiles.length})
                </span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  Total Merged: {uploadedFiles.reduce((acc, f) => acc + f.recordCount, 0).toLocaleString()} Rows
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 hover:border-slate-300 shadow-xs transition-all animate-fadeIn"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-700 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[9px] font-semibold text-slate-400">
                          {file.recordCount.toLocaleString()} rows extracted
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFile(file.id);
                      }}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title={`Remove ${file.name} dataset`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dataset Controls & EXPORTS */}
        <div className="flex flex-col justify-between space-y-4 bg-slate-50 rounded-lg p-5 border border-slate-200">
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Template & Reset
            </div>
            <button
              id="download-template-btn"
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 text-xs font-semibold rounded shadow-sm transition-colors"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Download Spreadsheet Template
            </button>
            
            {uploadedFiles.length > 0 && (
              <button
                id="reset-data-btn"
                onClick={onResetData}
                className="flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Reset to Sample Dataset
              </button>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Strategic Exporters
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="export-csv-btn"
                onClick={handleExportCSV}
                disabled={filteredRecords.length === 0}
                className="flex items-center justify-center gap-1 px-2.5 py-2 bg-white border border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 text-xs font-semibold rounded shadow-sm disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 transition-colors"
                title="Export current filtered list to a CSV spreadsheet"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                Export CSV
              </button>
              <button
                id="export-txt-btn"
                onClick={handleExportStrategicTXT}
                disabled={filteredRecords.length === 0}
                className="flex items-center justify-center gap-1 px-2.5 py-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-blue-50 text-xs font-semibold rounded shadow-sm disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 transition-colors"
                title="Download tactical text-briefing for filtered scope"
              >
                <FileText className="h-4 w-4 text-blue-500" />
                Strategic TXT
              </button>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Filter Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <span>Interactive Corporate Filters ({filteredRecords.length} Rows Active)</span>
          </div>
          {(filters.categories.length > 0 || 
            filters.regions.length > 0 || 
            filters.segments.length > 0 || 
            filters.weeks.length > 0 || 
            filters.stores.length > 0 || 
            filters.cities.length > 0 || 
            filters.storeFormats.length > 0) && (
            <button
              id="clear-filters-btn"
              onClick={resetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 self-start sm:self-center"
            >
              <X className="h-3.5 w-3.5" />
              Reset All Filters
            </button>
          )}
        </div>

        {/* Interconnected Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* 1. Product Category Filter */}
          <DropdownFilter
            label="Product Category"
            placeholder="All Categories"
            options={availableCategories}
            selectedValues={filters.categories}
            onChange={(values) => setFilters((prev) => ({ ...prev, categories: values }))}
          />

          {/* 2. Week Filter */}
          <DropdownFilter
            label="Week"
            placeholder="All Weeks"
            options={availableWeeks}
            selectedValues={filters.weeks}
            onChange={(values) => setFilters((prev) => ({ ...prev, weeks: values }))}
          />

          {/* 3. Operating Region */}
          <DropdownFilter
            label="Region"
            placeholder="All Regions"
            options={availableRegions}
            selectedValues={filters.regions}
            onChange={(values) => handleStoreInterconnection("regions", values)}
          />

          {/* 4. City Location */}
          <DropdownFilter
            label="City"
            placeholder="All Cities"
            options={availableCities}
            selectedValues={filters.cities}
            onChange={(values) => handleStoreInterconnection("cities", values)}
          />

          {/* 5. Store Format */}
          <DropdownFilter
            label="Store Format"
            placeholder="All Formats"
            options={availableStoreFormats}
            selectedValues={filters.storeFormats}
            onChange={(values) => handleStoreInterconnection("storeFormats", values)}
          />

          {/* 6. Store */}
          <DropdownFilter
            label="Store"
            placeholder="All Stores"
            options={availableStores}
            selectedValues={filters.stores}
            onChange={(values) => handleStoreInterconnection("stores", values)}
          />

        </div>
      </div>
    </div>
  );
}
