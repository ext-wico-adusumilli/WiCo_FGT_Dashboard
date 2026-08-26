import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { cookieHelpers, COOKIE_KEYS } from '../../utils/cookies';

interface TransitionEntry {
  _id: string;
  branch: string;
  forwardMin: number | null;
  forwardMean: number | null;
  forwardMax: number | null;
  backwardMin: number | null;
  backwardMean: number | null;
  backwardMax: number | null;
  totalForward: number | null;
  totalBackward: number | null;
}

interface TransitionDistanceChartProps {
  entries: TransitionEntry[];
  dateRange?: { start: string | null; end: string | null };
  onClearFilters?: () => void;
  onQuickFilterChange?: (start: string | null, end: string | null) => void;
}

type ChartDateFilter = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'all';

export function TransitionDistanceChart({ entries, dateRange, onClearFilters, onQuickFilterChange }: TransitionDistanceChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [chartDateFilter, setChartDateFilter] = useState<ChartDateFilter>(() =>
    (cookieHelpers.getFilterState<ChartDateFilter>(COOKIE_KEYS.TRANSITION_DISTANCE_CHART_DATE_FILTER)) || 'last7days'
  );
  
  const isDark = theme === 'dark';
  const axisTextColor = am5.color(isDark ? 0xffffff : 0x111827);
  const gridColor = am5.color(isDark ? 0xffffff : 0x94a3b8);
  const legendTextColor = am5.color(isDark ? 0xffffff : 0x111827);

  // Check if external filters are applied (from parent component)
  const hasExternalFilters = dateRange && (dateRange.start || dateRange.end);

  // Save chart date filter to cookies
  useEffect(() => {
    cookieHelpers.setFilterState(COOKIE_KEYS.TRANSITION_DISTANCE_CHART_DATE_FILTER, chartDateFilter);
  }, [chartDateFilter]);

  // Reset chart filter when external date range is applied
  useEffect(() => {
    if (hasExternalFilters) {
      setChartDateFilter('all'); // Reset to indicate external filtering
    }
  }, [hasExternalFilters]);

  // Handle quick filter changes
  const handleQuickFilterChange = (filter: ChartDateFilter) => {
    if (!onQuickFilterChange) return;
    
    setChartDateFilter(filter);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        onQuickFilterChange(todayStr, todayStr);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        onQuickFilterChange(yesterdayStr, yesterdayStr);
        break;
      case 'last7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        onQuickFilterChange(sevenDaysAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]);
        break;
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        onQuickFilterChange(thisMonthStart.toISOString().split('T')[0], today.toISOString().split('T')[0]);
        break;
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        onQuickFilterChange(lastMonthStart.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0]);
        break;
      case 'all':
        onQuickFilterChange(null, null);
        break;
    }
  };

  // Filter entries based on chart date filter (only if no external filters are applied)
  const getFilteredEntriesByDateRange = () => {
    // If external filters are applied, use entries as-is (they're already filtered by parent)
    if (hasExternalFilters) {
      return entries;
    }

    // For transition distance data, we don't have date fields in the entries
    // So we'll just return all entries for now
    // This could be enhanced if date information is added to the transition distance data
    return entries;
  };

  useLayoutEffect(() => {
    if (!chartRef.current) return;

    // Dispose existing root if it exists
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

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
      fill: legendTextColor,
    });

    // Process data - filter out entries with null mean values
    const filteredEntries = getFilteredEntriesByDateRange();
    const data = filteredEntries
      .filter(entry => entry.forwardMean !== null && entry.backwardMean !== null)
      .slice(0, 10)
      .map(entry => ({
        branch: entry.branch,
        forwardMean: Number(entry.forwardMean!.toFixed(2)),
        backwardMean: Number(entry.backwardMean!.toFixed(2)),
        totalForward: entry.totalForward ?? 0,
        totalBackward: entry.totalBackward ?? 0,
      }));

    // Create axes
    const xRenderer = am5xy.AxisRendererX.new(root, {
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
      minorGridEnabled: true,
    });

    // Style x-axis grid and labels to white
    xRenderer.grid.template.setAll({
      location: 1,
      stroke: gridColor,
      strokeOpacity: isDark ? 0.2 : 0.35,
    });

    xRenderer.labels.template.setAll({
      fill: axisTextColor,
      fontSize: 10,
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'branch',
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    xAxis.data.setAll(data);

    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1,
    });

    // Style y-axis grid and labels to white
    yRenderer.grid.template.setAll({
      stroke: gridColor,
      strokeOpacity: isDark ? 0.2 : 0.35,
    });

    yRenderer.labels.template.setAll({
      fill: axisTextColor,
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
      })
    );

    // Add series for Forward Mean Distance
    const forwardSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Forward Mean (m)',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'forwardMean',
        categoryXField: 'branch',
        fill: am5.color(0x3ec1c5),
        stroke: am5.color(0x3ec1c5),
      })
    );

    forwardSeries.columns.template.setAll({
      tooltipText: '{name}, {categoryX}: {valueY}m',
      width: am5.percent(80),
      tooltipY: 0,
      strokeOpacity: 0,
    });

    forwardSeries.data.setAll(data);
    forwardSeries.appear();

    forwardSeries.bullets.push(function () {
      return am5.Bullet.new(root, {
        locationY: 0,
        sprite: am5.Label.new(root, {
          text: '{valueY}',
          fill: root.interfaceColors.get('alternativeText'),
          centerY: 0,
          centerX: am5.p50,
          populateText: true,
          fontSize: 10,
        }),
      });
    });

    legend.data.push(forwardSeries);

    // Add series for Backward Mean Distance
    const backwardSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Backward Mean (m)',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'backwardMean',
        categoryXField: 'branch',
        fill: am5.color(0xa78bfa),
        stroke: am5.color(0xa78bfa),
      })
    );

    backwardSeries.columns.template.setAll({
      tooltipText: '{name}, {categoryX}: {valueY}m',
      width: am5.percent(80),
      tooltipY: 0,
      strokeOpacity: 0,
    });

    backwardSeries.data.setAll(data);
    backwardSeries.appear();

    backwardSeries.bullets.push(function () {
      return am5.Bullet.new(root, {
        locationY: 0,
        sprite: am5.Label.new(root, {
          text: '{valueY}',
          fill: root.interfaceColors.get('alternativeText'),
          centerY: 0,
          centerX: am5.p50,
          populateText: true,
          fontSize: 10,
        }),
      });
    });

    legend.data.push(backwardSeries);

    // Make stuff animate on load
    chart.appear(1000, 100);

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [entries, axisTextColor, gridColor, legendTextColor, isDark, chartDateFilter]);

  if (entries.length === 0) {
    return (
      <div className={`rounded-lg p-4 border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
          <h2 className={`text-base sm:text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Transition Distance by Branch</h2>
        </div>
        <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm text-center py-8`}>No data available</p>
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
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-3">
          <h2 className={`text-base sm:text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Transition Distance by Branch
          </h2>
          {onClearFilters && hasExternalFilters && (
            <button
              onClick={onClearFilters}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                isDark
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
              onClick={() => !hasExternalFilters && handleQuickFilterChange(key)}
              disabled={!!hasExternalFilters}
              className={`px-2 py-1 text-xs rounded transition ${
                hasExternalFilters
                  ? isDark
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : chartDateFilter === key
                    ? isDark
                      ? 'bg-[#3EC1C5] text-gray-900 font-semibold'
                      : 'bg-gray-900 text-white font-semibold'
                    : isDark
                      ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        
        {/* Custom Range Indicator - Show when external date range is applied */}
        {hasExternalFilters && dateRange && (dateRange.start || dateRange.end) && (
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 text-xs rounded font-semibold ${
              isDark
                ? 'bg-[#3EC1C5] text-gray-900'
                : 'bg-gray-900 text-white'
            }`}>
              Custom Range: {dateRange.start || 'Start'} to {dateRange.end || 'End'}
            </div>
          </div>
        )}
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}

