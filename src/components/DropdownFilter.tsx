import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

interface DropdownFilterProps {
  label: string;
  placeholder: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
}

export default function DropdownFilter({
  label,
  placeholder,
  options,
  selectedValues,
  onChange,
  searchable = true,
}: DropdownFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Safely map all options to strings to avoid type-coercion or crash issues (e.g. numeric columns)
  const stringOptions = React.useMemo(() => {
    return options.map((opt) => (opt !== null && opt !== undefined ? String(opt) : ""));
  }, [options]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    onChange([...stringOptions]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const filteredOptions = stringOptions.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      return selectedValues[0];
    }
    if (selectedValues.length === stringOptions.length) {
      return `All ${label}s`;
    }
    return `${selectedValues.length} Selected`;
  };

  return (
    <div className="space-y-1.5 relative w-full" ref={dropdownRef}>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
        {label}
      </label>
      
      {/* Dropdown Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50 border rounded font-semibold text-slate-700 cursor-pointer transition-all hover:bg-slate-100/50 ${
          isOpen ? "border-blue-500 ring-1 ring-blue-500 bg-white" : "border-slate-200"
        } ${selectedValues.length > 0 ? "border-blue-200 bg-blue-50/20 text-blue-900" : ""}`}
      >
        <span className="truncate pr-1">
          {getDisplayText()}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear Selection"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-500" : ""}`} />
        </div>
      </div>

      {/* Floating Panel */}
      {isOpen && (
        <div className="absolute top-[100%] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 animate-fadeIn min-w-[200px] max-h-[280px] flex flex-col">
          {/* Search box inside dropdown */}
          {searchable && stringOptions.length > 5 && (
            <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50/50">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search options..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent border-0 p-0 focus:ring-0 focus:outline-none text-slate-700 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Quick Actions (Select All / Clear) */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className="hover:text-blue-600 transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="hover:text-rose-600 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 p-1 max-h-[180px]">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                No matching options
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option);
                return (
                  <div
                    key={option}
                    onClick={() => handleToggleOption(option)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs cursor-pointer font-medium transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <div className={`h-3.5 w-3.5 border rounded flex items-center justify-center transition-colors shrink-0 ${
                      isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white"
                    }`}>
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3px]" />}
                    </div>
                    <span className="truncate">{option}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
