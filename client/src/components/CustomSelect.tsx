import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  searchable = false
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  // Filter options based on search term
  const filteredOptions = searchable && searchTerm
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateDropdownDirection = () => {
    if (!buttonRef.current) return 'down';
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = Math.min(240, options.length * 40); // Estimate dropdown height
    
    // Check if there's enough space below
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    // If not enough space below but enough space above, show upward
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      return 'up';
    }
    
    return 'down';
  };

  const handleToggle = () => {
    if (!isOpen) {
      const direction = calculateDropdownDirection();
      setDropdownDirection(direction);
    }
    setIsOpen(!isOpen);
  };

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} className={`relative ${className} ${isOpen ? 'z-[9999]' : ''}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`w-full px-3 py-2 border rounded-lg text-xs sm:text-sm flex items-center justify-between transition-colors ${
          theme === 'dark'
            ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600 focus:ring-1 focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
            : 'bg-gray-50 border-gray-300 text-gray-900 hover:bg-gray-100 focus:ring-1 focus:ring-gray-900 focus:border-gray-900'
        }`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''} ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute z-[9999] w-full border rounded-lg shadow-lg max-h-60 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] ${
          dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
        } ${
          theme === 'dark' 
            ? 'bg-gray-700 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          {/* Search Input */}
          {searchable && (
            <div className={`p-2 border-b ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
              <div className="relative">
                <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className={`w-full pl-7 pr-2 py-1.5 text-xs rounded border ${
                    theme === 'dark'
                      ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:border-[#3EC1C5]'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900'
                  } focus:outline-none focus:ring-1 focus:ring-[#3EC1C5]`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="py-1 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden">
            {filteredOptions.length === 0 ? (
              <div className={`px-3 py-2 text-[11px] text-center ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                No results found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2 text-left text-[11px] sm:text-xs transition-colors flex items-center ${
                    option.value === value
                      ? theme === 'dark'
                        ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                        : 'bg-gray-900/10 text-gray-900 font-medium'
                      : theme === 'dark'
                        ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                        : 'text-gray-700 hover:bg-gray-100'
                  } ${
                    index < filteredOptions.length - 1 
                      ? theme === 'dark' 
                        ? 'border-b border-gray-600' 
                        : 'border-b border-gray-200'
                      : ''
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

