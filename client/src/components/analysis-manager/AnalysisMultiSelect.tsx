import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface AnalysisMultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function AnalysisMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = ''
}: AnalysisMultiSelectProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeValue = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const selectAll = () => {
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(o => o.value));
    }
  };

  const selectedItems = value.map(v => ({
    value: v,
    label: options.find(o => o.value === v)?.label || v
  }));

  return (
    <div ref={containerRef} className={`relative ${className} ${isOpen ? 'z-[9999]' : ''}`}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer min-h-[36px] ${
          theme === 'dark'
            ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
            : 'bg-gray-50 border-gray-300 text-gray-900 hover:bg-gray-100'
        }`}
      >
        <div className="flex-1 flex flex-wrap gap-1 items-center">
          {selectedItems.length === 0 ? (
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{placeholder}</span>
          ) : (
            selectedItems.map(item => (
              <span
                key={item.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#3EC1C5]/20 text-[#3EC1C5] text-xs"
              >
                {item.label}
                <span onClick={(e) => removeValue(item.value, e)} className="hover:bg-[#3EC1C5]/30 rounded cursor-pointer">
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`h-3 w-3 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''} ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`} />
      </div>

      {isOpen && (
        <div className={`absolute z-[9999] w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] ${
          theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
        }`}>
          <div className="py-1 [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={selectAll}
              className={`w-full px-3 py-2 text-left text-[11px] transition-colors flex items-center justify-between border-b ${
                theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
              } ${
                value.length === options.length
                  ? theme === 'dark' ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium' : 'bg-gray-900/10 text-gray-900 font-medium'
                  : theme === 'dark' ? 'text-gray-200 hover:bg-[#3EC1C5]/20' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>All</span>
              {value.length === options.length && (
                <Check className={`w-3 h-3 flex-shrink-0 ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`} />
              )}
            </button>

            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={`w-full px-3 py-2 text-left text-[11px] transition-colors flex items-center justify-between ${
                  value.includes(option.value)
                    ? theme === 'dark' ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium' : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark' ? 'text-gray-200 hover:bg-[#3EC1C5]/20' : 'text-gray-700 hover:bg-gray-100'
                } ${
                  index < options.length - 1
                    ? theme === 'dark' ? 'border-b border-gray-600' : 'border-b border-gray-200'
                    : ''
                }`}
              >
                <span>{option.label}</span>
                {value.includes(option.value) && (
                  <Check className={`w-3 h-3 flex-shrink-0 ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
