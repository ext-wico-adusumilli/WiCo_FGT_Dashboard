import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { useTheme } from '../../contexts/ThemeContext';
import { cookieHelpers, COOKIE_KEYS } from '../../utils/cookies';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  flight: boolean;
}

interface FlightHoursChartProps {
  entries: LogEntry[];
  onBarClick?: (date: string, sn: string) => void;
  selectedFilters?: { 
    date?: string; 
    sn?: string;
    dateRange?: { start: string | null; end: string | null }; // Add date range support
  };
  onClearFilters?: () => void;
}

type ChartDateFilter = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'all';

export function FlightHoursChart({ entries, onBarClick, selectedFilters, onClearFilters }: FlightHoursChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [chartDateFilter, setChartDateFilter] = useState<ChartDateFilter>(() =>
    (cookieHelpers.getFilterState<ChartDateFilter>(COOKIE_KEYS.GENERAL_OVERVIEW_CHART_DATE_FILTER)) || 'last7days'
  );

  // Check if external filters are applied (from parent component)
  const hasExternalFilters = selectedFilters?.date || selectedFilters?.sn || 
    (selectedFilters?.dateRange && (selectedFilters.dateRange.start || selectedFilters.dateRange.end));

  // Save chart date filter to cookies
  useEffect(() => {
    cookieHelpers.setFilterState(COOKIE_KEYS.GENERAL_OVERVIEW_CHART_DATE_FILTER, chartDateFilter);
  }, [chartDateFilter]);

  // Filter entries based on chart date filter (only if no external filters are applied)
  const getFilteredEntriesByDateRange = () => {
    // If external filters are applied, use entries as-is (they're already filtered by parent)
    if (hasExternalFilters) {
      return entries;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return entries.filter(entry => {
      const entryDate = parseDate(entry.date);
      
      switch (chartDateFilter) {
        case 'today':
          return entryDate.toDateString() === today.toDateString();
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return entryDate.toDateString() === yesterday.toDateString();
        case 'last7days':
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return entryDate >= sevenDaysAgo;
        case 'thisMonth':
          return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
        case 'lastMonth':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          return entryDate >= lastMonth && entryDate <= lastMonthEnd;
        case 'all':
        default:
          return true;
      }
    });
  };

  // Parse date from YYMMDD format
  const parseDate = (dateStr: string): Date => {
    if (!dateStr || dateStr.length !== 6) return new Date();
    
    const year = '20' + dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    
    return new Date(`${year}-${month}-${day}`);
  };

  useLayoutEffect(() => {
    if (!chartRef.current) return;

    // Create root element
    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;

    // Remove amCharts watermark
    root._logo?.dispose();

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        paddingLeft: 0,
        wheelX: 'panX',
        wheelY: 'zoomX',
        layout: root.verticalLayout,
      })
    );

    // Add legend with white text
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
      })
    );

    legend.labels.template.setAll({
      fill: am5.color(theme === 'dark' ? 0xffffff : 0x000000),
    });

    // Get filtered entries based on date range
    const filteredEntries = getFilteredEntriesByDateRange();

    // Process data
    const grouped = new Map<string, { date: Date; dateStr: string; data: Map<string, number> }>();
    
    filteredEntries.forEach(entry => {
      const date = parseDate(entry.date);
      const dateStr = `${String(date.getDate()).padStart(2, '0')}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear()}`;
      
      // Convert flight time from seconds to hours (decimal)
      const totalHours = entry.flight_time / 3600;
      
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, { date, dateStr, data: new Map() });
      }
      
      const entry_data = grouped.get(dateStr)!;
      const currentHours = entry_data.data.get(entry.sn) || 0;
      entry_data.data.set(entry.sn, currentHours + totalHours);
    });

    // Get unique SNs from filtered entries
    const uniqueSNs = Array.from(new Set(filteredEntries.map(e => e.sn)));
    
    // Sort by date (show all dates in range, not just last 10)
    const sortedEntries = Array.from(grouped.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Convert to chart data format
    const data = sortedEntries.map(entry => {
      const dataPoint: any = { date: entry.dateStr };
      uniqueSNs.forEach(sn => {
        dataPoint[sn] = Number((entry.data.get(sn) || 0).toFixed(2));
      });
      return dataPoint;
    });

    // Create axes
    const xRenderer = am5xy.AxisRendererX.new(root, {
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
      minorGridEnabled: true,
    });

    // Style x-axis grid and labels based on theme
    xRenderer.grid.template.setAll({
      location: 1,
      stroke: am5.color(theme === 'dark' ? 0xffffff : 0x000000),
      strokeOpacity: 0.2,
    });

    xRenderer.labels.template.setAll({
      fill: am5.color(theme === 'dark' ? 0xffffff : 0x000000),
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'date',
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    xAxis.data.setAll(data);

    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1,
    });

    // Style y-axis grid and labels based on theme
    yRenderer.grid.template.setAll({
      stroke: am5.color(theme === 'dark' ? 0xffffff : 0x000000),
      strokeOpacity: 0.2,
    });

    yRenderer.labels.template.setAll({
      fill: am5.color(theme === 'dark' ? 0xffffff : 0x000000),
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
      })
    );

    // Add series for each SN
    function makeSeries(name: string, fieldName: string) {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: fieldName,
          categoryXField: 'date',
        })
      );

      series.columns.template.setAll({
        tooltipText: '{name}, {categoryX}: {valueY}h',
        width: am5.percent(90),
        tooltipY: 0,
        strokeOpacity: 0,
        cursorOverStyle: 'pointer',
      });

      // Add click handler for filtering
      series.columns.template.events.on('click', function(ev) {
        const dataItem = ev.target.dataItem;
        if (dataItem && onBarClick) {
          const dataContext = dataItem.dataContext as any;
          const date = dataContext.date as string;
          const sn = name;
          onBarClick(date, sn);
        }
      });

      // Style bars based on selection
      series.columns.template.adapters.add('fill', function(fill, target) {
        const dataItem = target.dataItem;
        if (dataItem && selectedFilters) {
          const dataContext = dataItem.dataContext as any;
          const chartDate = dataContext.date as string;
          const sn = name;
          
          // Convert chart date (DD-MMM-YYYY) to filter date format (YYYY-MM-DD)
          const convertChartDateToFilterFormat = (dateStr: string): string => {
            const [day, month, year] = dateStr.split('-');
            const monthMap: { [key: string]: string } = {
              'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
              'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
              'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };
            return `${year}-${monthMap[month]}-${day.padStart(2, '0')}`;
          };
          
          const filterDate = convertChartDateToFilterFormat(chartDate);
          
          // Check if this bar matches the selected filters
          const isSelected = (!selectedFilters.date || selectedFilters.date === filterDate) &&
                           (!selectedFilters.sn || selectedFilters.sn === sn);
          
          if (selectedFilters.date || selectedFilters.sn) {
            // If filters are active, highlight selected bars and dim others
            if (isSelected) {
              return series.get('fill'); // Keep original color
            } else {
              return am5.color(theme === 'dark' ? 0x555555 : 0xcccccc); // Dimmed color
            }
          }
        }
        return fill;
      });

      // Add hover effects
      series.columns.template.states.create('hover', {
        fillOpacity: 0.8,
        strokeOpacity: 1,
        stroke: am5.color(theme === 'dark' ? 0xffffff : 0x000000),
        strokeWidth: 2,
      });

      series.data.setAll(data);

      // Make stuff animate on load
      series.appear();

      series.bullets.push(function () {
        return am5.Bullet.new(root, {
          locationY: 0,
          sprite: am5.Label.new(root, {
            text: '{valueY}',
            fill: root.interfaceColors.get('alternativeText'),
            centerY: 0,
            centerX: am5.p50,
            populateText: true,
          }),
        });
      });

      legend.data.push(series);
    }

    // Create series for each SN
    uniqueSNs.forEach(sn => {
      makeSeries(sn, sn);
    });

    // Make stuff animate on load
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [entries, theme, selectedFilters, chartDateFilter]);

  if (entries.length === 0) {
    return (
      <div className={`rounded-lg p-4 border ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-300'
      }`}>
        <h2 className={`text-base sm:text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Flight Hours per Date & SN</h2>
        <p className={`text-sm text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No data available</p>
      </div>
    );
  }

  const dateFilterButtons: { key: ChartDateFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last7days', label: 'Last 7 Days' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className={`rounded-lg p-3 sm:p-4 border ${
      theme === 'dark' 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-300'
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-3">
          <h2 className={`text-base sm:text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours per Date & SN
          </h2>
          <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Click bars to filter
          </span>
          {onClearFilters && (selectedFilters?.date || selectedFilters?.sn) && (
            <button
              onClick={onClearFilters}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300'
              }`}
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
        
        {/* Quick Date Filter Buttons - Always show but disable when external filters are applied */}
        <div className="flex flex-wrap items-center gap-1">
          {dateFilterButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => !hasExternalFilters && setChartDateFilter(key)}
              disabled={!!hasExternalFilters}
              className={`px-2 py-1 text-xs rounded transition ${
                hasExternalFilters
                  ? theme === 'dark'
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : chartDateFilter === key
                    ? theme === 'dark'
                      ? 'bg-[#3EC1C5] text-gray-900 font-semibold'
                      : 'bg-gray-900 text-white font-semibold'
                    : theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        
        {/* Custom Range Indicator - Show when external date range is applied */}
        {hasExternalFilters && selectedFilters?.dateRange && (selectedFilters.dateRange.start || selectedFilters.dateRange.end) && (
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 text-xs rounded font-semibold ${
              theme === 'dark'
                ? 'bg-[#3EC1C5] text-gray-900'
                : 'bg-gray-900 text-white'
            }`}>
              Custom Range: {selectedFilters.dateRange.start || 'Start'} to {selectedFilters.dateRange.end || 'End'}
            </div>
          </div>
        )}
        
        {/* External Filter Indicator for other filters */}
        {hasExternalFilters && (selectedFilters?.date || selectedFilters?.sn) && (
          <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Filtered by: {selectedFilters?.date && `Date: ${selectedFilters.date}`} {selectedFilters?.sn && `SN: ${selectedFilters.sn}`}
          </div>
        )}
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}

