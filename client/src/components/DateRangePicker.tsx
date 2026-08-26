import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatDateObjectDisplay, formatDateForAPI, parseDateDisplay } from '../utils/dateUtils';

interface DateRangePickerProps {
  onApply: (startDate: string | null, endDate: string | null) => void;
  onCancel?: () => void;
  className?: string;
  initialStart?: string | null;
  initialEnd?: string | null;
}

type PresetOption = 'allDays' | 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  onApply,
  onCancel,
  className = '',
  initialStart = null,
  initialEnd = null
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetOption | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    return prevMonth;
  });
  const [currentMonth2, setCurrentMonth2] = useState(new Date());
  const [displayText, setDisplayText] = useState('All Dates');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('left');
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Reset when initialStart/initialEnd change (e.g., when cleared externally)
  useEffect(() => {
    if (initialStart === null && initialEnd === null) {
      setStartDate(null);
      setEndDate(null);
      setSelectedPreset(null);
      setFromInput('');
      setToInput('');
      setDisplayText('All Dates');
    } else if (initialStart && initialEnd) {
      const start = new Date(initialStart);
      const end = new Date(initialEnd);
      setStartDate(start);
      setEndDate(end);
      setFromInput(formatDateObjectDisplay(start));
      setToInput(formatDateObjectDisplay(end));
      setDisplayText(`${formatDateObjectDisplay(start)} - ${formatDateObjectDisplay(end)}`);
    }
  }, [initialStart, initialEnd]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && dropdownRef.current && selectedPreset === 'custom') {
      const rect = dropdownRef.current.getBoundingClientRect();
      const dropdownWidth = 700; // min-w-[700px]
      const viewportWidth = window.innerWidth;
      
      // Check if dropdown would go off-screen on the right
      if (rect.left + dropdownWidth > viewportWidth - 20) { // 20px margin
        setDropdownPosition('right');
      } else {
        setDropdownPosition('left');
      }
    }
  }, [isOpen, selectedPreset]);

  const handlePresetClick = (preset: PresetOption) => {
    setSelectedPreset(preset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (preset) {
      case 'allDays':
        setStartDate(null);
        setEndDate(null);
        setFromInput('');
        setToInput('');
        break;
      case 'today':
        setStartDate(today);
        setEndDate(today);
        setFromInput(formatDateObjectDisplay(today));
        setToInput(formatDateObjectDisplay(today));
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(yesterday);
        setEndDate(yesterday);
        setFromInput(formatDateObjectDisplay(yesterday));
        setToInput(formatDateObjectDisplay(yesterday));
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        setStartDate(last7);
        setEndDate(today);
        setFromInput(formatDateObjectDisplay(last7));
        setToInput(formatDateObjectDisplay(today));
        break;
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 29);
        setStartDate(last30);
        setEndDate(today);
        setFromInput(formatDateObjectDisplay(last30));
        setToInput(formatDateObjectDisplay(today));
        break;
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(thisMonthStart);
        setEndDate(today);
        setFromInput(formatDateObjectDisplay(thisMonthStart));
        setToInput(formatDateObjectDisplay(today));
        break;
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(lastMonthStart);
        setEndDate(lastMonthEnd);
        setFromInput(formatDateObjectDisplay(lastMonthStart));
        setToInput(formatDateObjectDisplay(lastMonthEnd));
        break;
      case 'custom':
        // Keep current dates or reset
        break;
    }
  };

  const handleFromDateClick = (date: Date) => {
    if (selectedPreset !== 'custom') {
      setSelectedPreset('custom');
    }
    setStartDate(date);
    setFromInput(formatDateObjectDisplay(date));
  };

  const handleToDateClick = (date: Date) => {
    if (selectedPreset !== 'custom') {
      setSelectedPreset('custom');
    }
    if (startDate && date < startDate) {
      return; // Don't allow selecting a "to" date before "from" date
    }
    setEndDate(date);
    setToInput(formatDateObjectDisplay(date));
  };

  const handleFromInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromInput(value);
    
    // Try to parse the date (DD.MMM.YYYY format)
    const date = parseDateDisplay(value);
    if (date) {
      setStartDate(date);
      setCurrentMonth(date);
    }
  };

  const handleToInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToInput(value);
    
    // Try to parse the date (DD.MMM.YYYY format)
    const date = parseDateDisplay(value);
    if (date) {
      if (!startDate || date >= startDate) {
        setEndDate(date);
        setCurrentMonth2(date);
      }
    }
  };

  const handleApply = () => {
    if (selectedPreset === 'allDays' || (!startDate && !endDate)) {
      setDisplayText('All Dates');
      onApply(null, null);
      setIsOpen(false);
    } else if (startDate && endDate) {
      const start = formatDateForAPI(startDate);
      const end = formatDateForAPI(endDate);
      setDisplayText(`${formatDateObjectDisplay(startDate)} - ${formatDateObjectDisplay(endDate)}`);
      onApply(start, end);
      setIsOpen(false);
    } else if (startDate) {
      const start = formatDateForAPI(startDate);
      setDisplayText(formatDateObjectDisplay(startDate));
      onApply(start, start);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (onCancel) onCancel();
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedPreset(null);
    setFromInput('');
    setToInput('');
    setDisplayText('All Dates');
    onApply(null, null);
    setIsOpen(false);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      date.setHours(0, 0, 0, 0);
      const isSelected = startDate && date.getTime() === startDate.getTime();
      const isInRange = startDate && endDate && date >= startDate && date <= endDate;

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleFromDateClick(date)}
          className={`h-8 w-8 text-xs rounded transition ${
            isSelected
              ? theme === 'dark'
                ? 'bg-[#3EC1C5] text-white font-semibold'
                : 'bg-gray-900 text-white font-semibold'
              : isInRange
              ? theme === 'dark'
                ? 'bg-[#3EC1C5]/20 text-white'
                : 'bg-gray-900/20 text-gray-900'
              : theme === 'dark'
                ? 'text-gray-300 hover:bg-gray-600'
                : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const changeMonth = (offset: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const changeMonth2 = (offset: number) => {
    setCurrentMonth2(new Date(currentMonth2.getFullYear(), currentMonth2.getMonth() + offset, 1));
  };

  const renderCalendar2 = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth2);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth2.getFullYear(), currentMonth2.getMonth(), day);
      date.setHours(0, 0, 0, 0);
      const isSelected = endDate && date.getTime() === endDate.getTime();
      const isInRange = startDate && endDate && date >= startDate && date <= endDate;
      const isDisabled = !!(startDate && date < startDate);

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleToDateClick(date)}
          disabled={isDisabled}
          className={`h-8 w-8 text-xs rounded transition ${
            isDisabled
              ? theme === 'dark'
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 cursor-not-allowed'
              : isSelected
              ? theme === 'dark'
                ? 'bg-[#3EC1C5] text-white font-semibold'
                : 'bg-gray-900 text-white font-semibold'
              : isInRange
              ? theme === 'dark'
                ? 'bg-[#3EC1C5]/20 text-white'
                : 'bg-gray-900/20 text-gray-900'
              : theme === 'dark'
                ? 'text-gray-300 hover:bg-gray-600'
                : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div ref={dropdownRef} className={`relative ${className} ${isOpen ? 'z-[99999]' : ''}`}>
      {/* Trigger Button - Match CustomSelect style */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (buttonRef.current) {
            setButtonRect(buttonRef.current.getBoundingClientRect());
          }
          setIsOpen(!isOpen);
        }}
        className={`w-full px-3 py-2 border rounded-lg text-xs flex items-center justify-between transition-colors ${
          theme === 'dark'
            ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600 focus:ring-1 focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
            : 'bg-gray-50 border-gray-300 text-gray-900 hover:bg-gray-100 focus:ring-1 focus:ring-gray-900 focus:border-gray-900'
        }`}
      >
        <span className="truncate">
          {displayText}
        </span>
        <ChevronDown 
          className={`h-3 w-3 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''} ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && buttonRect && ReactDOM.createPortal(
        <div 
          ref={dropdownRef}
          className={`fixed z-[9999] rounded-lg shadow-lg border ${
            theme === 'dark' 
              ? 'bg-gray-700 border-gray-600' 
              : 'bg-white border-gray-300'
          } ${
            selectedPreset === 'custom' 
              ? `min-w-[700px]` 
              : ''
          }`}
          style={{
            top: (() => {
              const dropdownHeight = selectedPreset === 'custom' ? 450 : 280;
              const spaceBelow = window.innerHeight - buttonRect.bottom;
              const spaceAbove = buttonRect.top;
              
              // Prefer positioning above if there's more space above OR if space below is insufficient
              if (spaceAbove > spaceBelow || spaceBelow < dropdownHeight + 20) {
                // Position above, but ensure it doesn't go off top of screen
                const topPosition = Math.max(10, buttonRect.top - dropdownHeight - 4);
                return `${topPosition}px`;
              }
              // Otherwise position below
              return `${buttonRect.bottom + 4}px`;
            })(),
            left: (() => {
              if (selectedPreset === 'custom') {
                const dropdownWidth = 700;
                const spaceRight = window.innerWidth - buttonRect.left;
                // If not enough space on right, align to right edge
                if (spaceRight < dropdownWidth) {
                  return `${Math.max(10, buttonRect.right - dropdownWidth)}px`;
                }
              }
              return `${buttonRect.left}px`;
            })(),
            width: selectedPreset === 'custom' ? undefined : `${buttonRect.width}px`,
            maxHeight: (() => {
              const spaceBelow = window.innerHeight - buttonRect.bottom;
              const spaceAbove = buttonRect.top;
              const maxSpace = Math.max(spaceBelow, spaceAbove) - 20; // 20px margin
              return `${Math.min(maxSpace, window.innerHeight * 0.7)}px`;
            })(),
            overflowY: 'auto'
          }}
        >
          <div className="flex gap-0">
            {/* Preset Options */}
            <div className={`flex flex-col py-1 ${selectedPreset === 'custom' ? 'min-w-[140px]' : 'w-full'}`}>
              <button
                type="button"
                onClick={() => handlePresetClick('allDays')}
                className={`px-3 py-2 text-left text-[11px] rounded transition border-b ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                } ${
                  selectedPreset === 'allDays'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('today')}
                className={`px-3 py-2 text-left text-[11px] rounded transition border-b ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                } ${
                  selectedPreset === 'today'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('yesterday')}
                className={`px-3 py-2 text-left text-[11px] rounded transition border-b ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                } ${
                  selectedPreset === 'yesterday'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('last7')}
                className={`px-3 py-2 text-left text-[11px] rounded transition border-b ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                } ${
                  selectedPreset === 'last7'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('last30')}
                className={`px-3 py-2 text-left text-[11px] rounded transition border-b ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                } ${
                  selectedPreset === 'last30'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('thisMonth')}
                className={`px-3 py-2 text-left text-[11px] rounded transition border-b ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                } ${
                  selectedPreset === 'thisMonth'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('lastMonth')}
                className={`px-3 py-2 text-left text-[11px] rounded transition border-b ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                } ${
                  selectedPreset === 'lastMonth'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('custom')}
                className={`px-3 py-2 text-left text-[11px] rounded transition ${
                  selectedPreset === 'custom'
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5]/30 text-[#3EC1C5] font-medium'
                      : 'bg-gray-900/10 text-gray-900 font-medium'
                    : theme === 'dark'
                      ? 'text-gray-200 hover:bg-[#3EC1C5]/20'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Custom Range
              </button>


            </div>

            {/* Calendars - Only show for Custom Range */}
            {selectedPreset === 'custom' && (
              <div className={`flex flex-col gap-3 p-3 border-l ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                {/* Date Input Fields */}
                <div className={`flex gap-3 pb-3 border-b ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                  <div className="flex-1">
                    <label className={`text-xs mb-1 block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>From Date</label>
                    <input
                      type="text"
                      value={fromInput}
                      onChange={handleFromInputChange}
                      placeholder="DD.MMM.YYYY"
                      className={`w-full px-2 py-1.5 border rounded text-xs ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-white focus:ring-1 focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                          : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900 focus:border-gray-900'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={`text-xs mb-1 block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>To Date</label>
                    <input
                      type="text"
                      value={toInput}
                      onChange={handleToInputChange}
                      placeholder="DD.MMM.YYYY"
                      className={`w-full px-2 py-1.5 border rounded text-xs ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-white focus:ring-1 focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                          : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900 focus:border-gray-900'
                      }`}
                    />
                  </div>
                </div>

                {/* Calendars */}
                <div className="flex gap-3">
                  {/* First Calendar (From) */}
                  <div className="flex-1">
                    <div className={`text-xs mb-2 text-center font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>FROM</div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className={`p-1 rounded transition ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                      >
                        <ChevronLeft className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className={`p-1 rounded transition ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                      >
                        <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className={`h-8 w-8 flex items-center justify-center text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {renderCalendar()}
                    </div>
                  </div>

                  {/* Second Calendar (To) */}
                  <div className="flex-1">
                    <div className={`text-xs mb-2 text-center font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>TO</div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => changeMonth2(-1)}
                        className={`p-1 rounded transition ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                      >
                        <ChevronLeft className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {monthNames[currentMonth2.getMonth()]} {currentMonth2.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeMonth2(1)}
                        className={`p-1 rounded transition ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                      >
                        <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className={`h-8 w-8 flex items-center justify-center text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {renderCalendar2()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`flex gap-2 p-3 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedPreset !== 'allDays' && !startDate}
              className={`px-4 py-1.5 text-xs font-medium rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-[#3EC1C5] hover:bg-[#35a9ad] text-white'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
              }`}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={`px-4 py-1.5 text-xs font-medium rounded transition ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clear
            </button>
            {selectedPreset === 'custom' && (
              <button
                type="button"
                onClick={handleCancel}
                className={`px-4 py-1.5 text-xs font-medium rounded transition ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Cancel
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

