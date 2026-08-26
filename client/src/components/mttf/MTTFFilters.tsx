import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, ChevronDown, Search } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cookieHelpers, COOKIE_KEYS } from '../../utils/cookies';

interface MTTFFiltersProps {
  onFilterChange?: (filters: FilterValues) => void;
  initialFilters?: FilterValues;
}

export interface FilterValues {
  uaName: string;
  ticket: string;
}

export interface FilterOptions {
  uaNames: string[];
  tickets: { value: string; ticketLink?: string }[];
}

export function MTTFFilters({ onFilterChange, initialFilters }: MTTFFiltersProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Initialize filters from cookies or props
  const [filters, setFilters] = useState<FilterValues>(() => {
    // First try to get from cookies
    const savedFilters = cookieHelpers.getFilterState<FilterValues>(COOKIE_KEYS.MTTF_FILTERS);
    if (savedFilters) {
      return savedFilters;
    }
    // Fall back to initialFilters or default
    return initialFilters || {
      uaName: '',
      ticket: '',
    };
  });

  const [options, setOptions] = useState<FilterOptions>({
    uaNames: [],
    tickets: [],
  });

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<{ [key: string]: string }>({
    uaName: '',
    ticket: ''
  });
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Load filter options from API
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/filters`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setOptions({
            uaNames: data.uaNames.map((item: any) => item.value),
            tickets: data.tickets.map((item: any) => ({ value: item.value, ticketLink: item.ticketLink })),
          });
        }
      } catch (error) {
        console.error('Error fetching filters:', error);
      }
    };

    fetchFilters();
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedOutside = Object.values(dropdownRefs.current).every(
        ref => ref && !ref.contains(event.target as Node)
      );
      if (clickedOutside) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFilterChange = (field: keyof FilterValues, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    
    // Save to cookies
    cookieHelpers.setFilterState(COOKIE_KEYS.MTTF_FILTERS, newFilters);
    
    onFilterChange?.(newFilters);
    setOpenDropdown(null);
    // Reset search term
    setSearchTerm(prev => ({ ...prev, [field]: '' }));
  };

  const toggleDropdown = (field: string) => {
    const newOpenState = openDropdown === field ? null : field;
    setOpenDropdown(newOpenState);
    // Reset search term when closing
    if (!newOpenState) {
      setSearchTerm(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleClear = () => {
    const clearedFilters = {
      uaName: '',
      ticket: '',
    };
    setFilters(clearedFilters);
    
    // Clear from cookies
    cookieHelpers.setFilterState(COOKIE_KEYS.MTTF_FILTERS, clearedFilters);
    
    onFilterChange?.(clearedFilters);
  };

  // Get ticket link from options
  const getTicketLink = () => {
    if (!filters.ticket) return null;
    const selectedTicket = options.tickets.find(t => t.value === filters.ticket);
    return selectedTicket?.ticketLink || null;
  };

  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-400">Filters:</span>
      <div className="flex flex-wrap items-start gap-2">
        {/* UA Name */}
        <div className="w-48 relative z-20">
          <div ref={el => dropdownRefs.current['uaName'] = el} className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown('uaName')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-1 text-xs flex items-center justify-between transition-colors ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-white hover:bg-gray-600 focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                  : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-900 focus:border-gray-900'
              }`}
            >
              <span className="truncate">
                {filters.uaName || "Select UA Name"}
              </span>
              <ChevronDown 
                className={`h-3 w-3 transition-transform ${
                  openDropdown === 'uaName' ? 'rotate-180' : ''
                } ${isDark ? 'text-gray-400' : 'text-gray-600'}`} 
              />
            </button>
            {openDropdown === 'uaName' && (
              <div className={`absolute z-30 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-hidden ${
                isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
              }`}>
                {/* Search Bar */}
                <div className={`sticky top-0 p-2 border-b ${
                  isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                  <div className="relative">
                    <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <input
                      type="text"
                      value={searchTerm.uaName}
                      onChange={(e) => setSearchTerm(prev => ({ ...prev, uaName: e.target.value }))}
                      placeholder="Search UA Name..."
                      className={`w-full pl-7 pr-2 py-1.5 text-xs rounded border focus:outline-none focus:ring-1 ${
                        isDark 
                          ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:ring-[#3EC1C5]'
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-gray-900'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                {/* Options List */}
                <div className="py-1 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {options.uaNames
                    .filter(name => name.toLowerCase().includes(searchTerm.uaName.toLowerCase()))
                    .map((name, index, filteredArray) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleFilterChange('uaName', name)}
                      className={`w-full px-3 py-2 text-left text-[11px] transition-colors flex items-center ${
                        name === filters.uaName 
                          ? isDark 
                            ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium' 
                            : 'bg-gray-900/10 text-gray-900 font-medium'
                          : isDark 
                            ? 'text-gray-200 hover:bg-[#3EC1C5]/20' 
                            : 'text-gray-700 hover:bg-gray-100'
                      } ${
                        index < filteredArray.length - 1 
                          ? isDark ? 'border-b border-gray-600' : 'border-b border-gray-200' 
                          : ''
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  {options.uaNames.filter(name => name.toLowerCase().includes(searchTerm.uaName.toLowerCase())).length === 0 && (
                    <div className={`px-3 py-2 text-xs text-center ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      No results found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ticket */}
        <div className="w-48 relative z-20">
          <div className="relative">
            <div ref={el => dropdownRefs.current['ticket'] = el} className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('ticket')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-1 text-xs flex items-center justify-between transition-colors ${
                  filters.ticket && getTicketLink() ? 'pr-8' : ''
                } ${
                  isDark 
                    ? 'border-gray-600 bg-gray-700 text-white hover:bg-gray-600 focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                    : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-900 focus:border-gray-900'
                }`}
              >
                <span className="truncate">
                  {filters.ticket || "Select Ticket"}
                </span>
                <ChevronDown 
                  className={`h-3 w-3 transition-transform ${
                    openDropdown === 'ticket' ? 'rotate-180' : ''
                  } ${isDark ? 'text-gray-400' : 'text-gray-600'}`} 
                />
              </button>
              {openDropdown === 'ticket' && (
                <div className={`absolute z-30 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-hidden ${
                  isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                }`}>
                  {/* Search Bar */}
                  <div className={`sticky top-0 p-2 border-b ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  }`}>
                    <div className="relative">
                      <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <input
                        type="text"
                        value={searchTerm.ticket}
                        onChange={(e) => setSearchTerm(prev => ({ ...prev, ticket: e.target.value }))}
                        placeholder="Search Ticket..."
                        className={`w-full pl-7 pr-2 py-1.5 text-xs rounded border focus:outline-none focus:ring-1 ${
                          isDark 
                            ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:ring-[#3EC1C5]'
                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-gray-900'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {/* Options List */}
                  <div className="py-1 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {options.tickets
                      .filter(ticket => ticket.value.toLowerCase().includes(searchTerm.ticket.toLowerCase()))
                      .map((ticket, index, filteredArray) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleFilterChange('ticket', ticket.value)}
                        className={`w-full px-3 py-2 text-left text-[11px] transition-colors flex items-center ${
                          ticket.value === filters.ticket 
                            ? isDark 
                              ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium' 
                              : 'bg-gray-900/10 text-gray-900 font-medium'
                            : isDark 
                              ? 'text-gray-200 hover:bg-[#3EC1C5]/20' 
                              : 'text-gray-700 hover:bg-gray-100'
                        } ${
                          index < filteredArray.length - 1 
                            ? isDark ? 'border-b border-gray-600' : 'border-b border-gray-200' 
                            : ''
                        }`}
                      >
                        {ticket.value}
                      </button>
                    ))}
                    {options.tickets.filter(ticket => ticket.value.toLowerCase().includes(searchTerm.ticket.toLowerCase())).length === 0 && (
                      <div className={`px-3 py-2 text-xs text-center ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        No results found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {filters.ticket && getTicketLink() && (
              <a
                href={getTicketLink() || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#3EC1C5] hover:text-[#35a9ad] transition pointer-events-auto z-40"
                title="Open ticket link"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
        
        {/* Clear Button */}
        {(filters.uaName || filters.ticket) && (
          <button
            onClick={handleClear}
            className={`flex items-center gap-1 px-2 py-1 text-xs transition mt-1 ${
              isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}


