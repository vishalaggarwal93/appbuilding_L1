import React, { useState, useMemo, useEffect } from "react";
import { SAMPLE_SALES_DATA } from "./sampleData";
import { SalesRecord, DashboardFilters } from "./types";
import { calculateMetrics } from "./utils/metrics";
import UploadAndFilters from "./components/UploadAndFilters";
import KPICards from "./components/KPICards";
import ChartsGrid from "./components/ChartsGrid";
import AIInsightsPanel from "./components/AIInsightsPanel";
import AIChatAssistant from "./components/AIChatAssistant";
import { LayoutDashboard, Brain, Database } from "lucide-react";

export default function App() {
  // Track multiple uploaded spreadsheets
  const [uploadedFiles, setUploadedFiles] = useState<{
    id: string;
    name: string;
    recordCount: number;
    records: SalesRecord[];
  }[]>([]);

  const [pythonInitialRecords, setPythonInitialRecords] = useState<SalesRecord[]>([]);

  // Fetch initial seed dataset from Python Excel backend on mount
  useEffect(() => {
    fetch("/api/python/initial-data")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then((data) => {
        if (data.status === "success" && Array.isArray(data.records)) {
          setPythonInitialRecords(data.records);
        }
      })
      .catch((err) => {
        console.error("Error fetching initial records from Python backend:", err);
      });
  }, []);

  // Compute primary raw dataset dynamically: merge spreadsheets if loaded, else fallback to standard sample or python-parsed data
  const salesRecords = useMemo(() => {
    if (uploadedFiles.length === 0) {
      return pythonInitialRecords.length > 0 ? pythonInitialRecords : SAMPLE_SALES_DATA;
    }
    return uploadedFiles.flatMap((f) => f.records);
  }, [uploadedFiles, pythonInitialRecords]);

  // Active dashboard filter states
  const [filters, setFilters] = useState<DashboardFilters>({
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

  // Calculate dynamic options based on current dataset to populate filter items automatically
  const availableCategories = useMemo(() => {
    return Array.from(new Set(salesRecords.map((r) => r.category))).filter(Boolean).sort();
  }, [salesRecords]);

  const availableRegions = useMemo(() => {
    return Array.from(new Set(salesRecords.map((r) => r.region))).filter(Boolean).sort();
  }, [salesRecords]);

  const availableSegments = useMemo(() => {
    return Array.from(new Set(salesRecords.map((r) => r.segment))).filter(Boolean).sort();
  }, [salesRecords]);

  const availableWeeks = useMemo(() => {
    const rawWeeks = Array.from(new Set(salesRecords.map((r) => r.week))).filter(Boolean) as string[];

    const isGenericWeek = (w: string) => /^[Ww](eek)?\s*\d+$/.test(w.trim());
    const hasNonGenericWeeks = rawWeeks.some((w) => !isGenericWeek(w));
    const weeks = hasNonGenericWeeks
      ? rawWeeks.filter((w) => !isGenericWeek(w))
      : rawWeeks;

    const parseDateHelper = (str: string) => {
      const parts = str.split(/[-/]/);
      if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year > 1000) {
          if (month > 12 && day <= 12) {
            const temp = day;
            day = month;
            month = temp;
          }
          return new Date(year, month - 1, day).getTime();
        }
      }
      const t = Date.parse(str);
      return isNaN(t) ? 0 : t;
    };

    return weeks.sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
      const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
      const isWeekA = a.toUpperCase().startsWith("WEEK") || a.toUpperCase().startsWith("W");
      const isWeekB = b.toUpperCase().startsWith("WEEK") || b.toUpperCase().startsWith("W");

      if (isWeekA && isWeekB && !isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }

      const timeA = parseDateHelper(a);
      const timeB = parseDateHelper(b);
      if (timeA !== 0 && timeB !== 0) {
        return timeA - timeB;
      }

      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [salesRecords]);

  const availableStores = useMemo(() => {
    return Array.from(new Set(salesRecords.map((r) => r.store))).filter(Boolean).sort();
  }, [salesRecords]);

  const availableCities = useMemo(() => {
    return Array.from(new Set(salesRecords.map((r) => r.city))).filter(Boolean).sort();
  }, [salesRecords]);

  const availableStoreFormats = useMemo(() => {
    return Array.from(new Set(salesRecords.map((r) => r.storeFormat))).filter(Boolean).sort();
  }, [salesRecords]);

  // Apply filters on the raw sales records
  const filteredRecords = useMemo(() => {
    return salesRecords.filter((record) => {
      // 1. Search Query
      if (
        filters.searchQuery &&
        !record.product.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
        !record.category.toLowerCase().includes(filters.searchQuery.toLowerCase())
      ) {
        return false;
      }

      // 2. Categories
      if (filters.categories.length > 0 && !filters.categories.includes(record.category)) {
        return false;
      }

      // 3. Regions
      if (filters.regions.length > 0 && !filters.regions.includes(record.region)) {
        return false;
      }

      // 4. Segments
      if (filters.segments.length > 0 && !filters.segments.includes(record.segment)) {
        return false;
      }

      // 5. Date Range Start
      if (filters.dateRange.start && record.date < filters.dateRange.start) {
        return false;
      }

      // 6. Date Range End
      if (filters.dateRange.end && record.date > filters.dateRange.end) {
        return false;
      }

      // 7. Weeks
      if (filters.weeks && filters.weeks.length > 0 && !filters.weeks.includes(record.week)) {
        return false;
      }

      // 8. Stores
      if (filters.stores && filters.stores.length > 0 && !filters.stores.includes(record.store)) {
        return false;
      }

      // 9. Cities
      if (filters.cities && filters.cities.length > 0 && !filters.cities.includes(record.city)) {
        return false;
      }

      // 10. Store Formats
      if (filters.storeFormats && filters.storeFormats.length > 0 && !filters.storeFormats.includes(record.storeFormat)) {
        return false;
      }

      return true;
    });
  }, [salesRecords, filters]);

  // Compute metrics based on filtered subset
  const filteredMetrics = useMemo(() => {
    return calculateMetrics(filteredRecords);
  }, [filteredRecords]);

  // Handler: When user uploads custom XLSX / CSV files
  const handleDataLoaded = (newFiles: { name: string; records: SalesRecord[] }[]) => {
    setUploadedFiles((prev) => {
      const updated = [...prev];
      newFiles.forEach((nf) => {
        const existingIdx = updated.findIndex((item) => item.name === nf.name);
        if (existingIdx > -1) {
          // Replace records for the same file name if re-uploaded
          updated[existingIdx] = {
            id: updated[existingIdx].id,
            name: nf.name,
            recordCount: nf.records.length,
            records: nf.records,
          };
        } else {
          // Add new file entry
          updated.push({
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: nf.name,
            recordCount: nf.records.length,
            records: nf.records,
          });
        }
      });
      return updated;
    });

    // Reset filters to accommodate new categories or timelines
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

  // Handler: Remove individual loaded file
  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Handler: Reset raw records back to original pre-loaded sample
  const handleResetData = () => {
    setUploadedFiles([]);
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

  return (
    <div id="app-root" className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      {/* Dynamic Header Banner */}
      <header id="dashboard-header" className="bg-[#0F172A] text-white border-b border-slate-800 py-4 px-6 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3B82F6] text-white rounded-lg flex items-center justify-center shadow-sm">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                RetailMetrics AI
              </h1>
              <p className="text-[11px] font-medium text-slate-400">
                Enterprise Retail Sales Intelligence & Strategic Matrix Engine
              </p>
            </div>
          </div>

          {/* Dataset source badge */}
          <div className="flex items-center gap-2.5 self-start md:self-center">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Database className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px] font-semibold text-slate-300">
                {uploadedFiles.length > 0 
                  ? `${uploadedFiles.length} file(s) active` 
                  : "Standard Dataset"}
              </span>
            </div>
            <div className="bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-blue-300 font-bold text-xs px-3 py-1.5 rounded-lg">
              {filteredRecords.length} of {salesRecords.length} records filtered
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="dashboard-main" className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Upload & Filters Component */}
        <section id="filters-section">
          <UploadAndFilters
            filters={filters}
            setFilters={setFilters}
            onDataLoaded={handleDataLoaded}
            onResetData={handleResetData}
            uploadedFiles={uploadedFiles}
            onRemoveFile={handleRemoveFile}
            availableCategories={availableCategories}
            availableRegions={availableRegions}
            availableSegments={availableSegments}
            availableWeeks={availableWeeks}
            availableStores={availableStores}
            availableCities={availableCities}
            availableStoreFormats={availableStoreFormats}
            filteredRecords={filteredRecords}
            salesRecords={salesRecords}
          />
        </section>

        {/* Aggregate KPI Cards */}
        <section id="kpi-cards-section">
          <KPICards metrics={filteredMetrics} />
        </section>

        {/* Visual Charts & Diagnostic Chat row */}
        <section id="analytics-grid-section" className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <ChartsGrid records={filteredRecords} />
          </div>
          <div className="xl:col-span-1">
            <AIChatAssistant records={filteredRecords} />
          </div>
        </section>

        {/* Automated Intelligence Report */}
        <section id="ai-insights-section">
          <AIInsightsPanel records={filteredRecords} />
        </section>
      </main>

      {/* Footer */}
      <footer id="dashboard-footer" className="bg-white border-t border-slate-100 py-5 text-center mt-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-semibold">
          <div>© 2026 Retail Sales Intelligence. Securely sandboxed analysis.</div>
          <div className="flex items-center gap-1">
            <Brain className="h-3.5 w-3.5 text-emerald-500" />
            <span>Augmented with Google Gemini LLMs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
