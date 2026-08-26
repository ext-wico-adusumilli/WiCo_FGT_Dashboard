import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

interface SNOverviewChartsOptimizedProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  onFilterChange?: (filter: { type: string; range: { min: number; max: number }; label: string; source?: string } | null) => void;
  expandedMetric?: 'flightTime' | 'distance' | null;
  preloadedChartData?: Record<string, any[]>;
  preloadingStatus?: 'idle' | 'loading' | 'complete' | 'error';
}

export function SNOverviewChartsOptimized({
  onFilterChange,
  expandedMetric,
  preloadedChartData = {},
  preloadingStatus = 'idle'
}: SNOverviewChartsOptimizedProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Get chart data for the current metric (instant - already preloaded!)
  const chartData = useMemo(() => {
    const displayStartTime = performance.now();

    console.log('🔍 === SN OVERVIEW CHART DATA DEBUG ===');
    console.log('📊 expandedMetric:', expandedMetric);
    console.log('📊 preloadedChartData keys:', Object.keys(preloadedChartData));

    if (!expandedMetric) {
      console.log('❌ No expandedMetric - returning empty array');
      return [];
    }

    // Use preloaded data if available
    if (preloadedChartData[expandedMetric]) {
      const data = preloadedChartData[expandedMetric];
      const displayEndTime = performance.now();
      const displayTime = Math.round(displayEndTime - displayStartTime);
      console.log(`⚡ INSTANT CHART DISPLAY: ${expandedMetric} in ${displayTime}ms (${data.length} ranges) from preloaded data`);
      console.log(`📊 ${expandedMetric} chart data sample:`, data.slice(0, 2));

      // Check if data has valid flight hours
      const totalHours = data.reduce((sum, item) => sum + (item.hours || 0), 0);
      console.log(`📊 ${expandedMetric} total flight hours in chart data: ${totalHours}`);

      if (data.length === 0) {
        console.log(`⚠️ ${expandedMetric} preloaded data exists but is empty array!`);
      } else if (totalHours === 0) {
        console.log(`⚠️ ${expandedMetric} has ${data.length} ranges but 0 total flight hours!`);
      }

      return data;
    }

    console.log(`⚠️ No preloaded data available for ${expandedMetric} - chart will be empty`);
    return [];
  }, [expandedMetric, preloadedChartData]);

  // Handle bar click
  const handleBarClick = (data: any) => {
    // console.log('Bar clicked:', data);
    if (onFilterChange && expandedMetric && data) {
      let payload = data;
      if (data.activePayload && data.activePayload.length > 0) {
        payload = data.activePayload[0].payload;
      } else if (data.payload) {
        payload = data.payload;
      }

      // console.log('Bar click payload:', payload);

      if (payload && payload.min !== undefined && payload.max !== undefined) {
        const filter = {
          type: expandedMetric,
          range: { min: payload.min, max: payload.max },
          label: payload.range || payload.label || `${payload.min}-${payload.max}`,
          source: 'chart'
        };
        // console.log('Setting filter:', filter);
        onFilterChange(filter);
      }
    }
  };

  const metricLabels = {
    flightTime: 'Flight Time',
    distance: 'Distance'
  };

  const metricColors = {
    flightTime: '#FB923C',
    distance: '#60A5FA'
  };

  const axisColor = isDark ? '#9CA3AF' : '#4B5563';
  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
  const tooltipText = isDark ? '#F3F4F6' : '#111827';

  // Show loading state while preloading
  if (preloadingStatus === 'loading') {
    return (
      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Flight Hours Distribution
        </h3>
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div>Preloading all chart data in background...</div>
            <div className="text-xs">This happens once when filters change</div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (preloadingStatus === 'error') {
    return (
      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Flight Hours Distribution
        </h3>
        <div className={`text-center py-8 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          <div className="flex flex-col items-center gap-3">
            <div>⚠️ Failed to preload chart data</div>
            <div className="text-xs">Charts will not be available until preloading succeeds</div>
          </div>
        </div>
      </div>
    );
  }

  // Don't show anything if no metric is selected
  if (!expandedMetric) {
    return (
      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Flight Hours Distribution
        </h3>
        <div className={`text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm">All chart data preloaded and ready! Click any metric above to view instantly.</span>
          </div>
          {Object.keys(preloadedChartData).length > 0 && (
            <div className="mt-2 text-xs">
              Preloaded: {Object.keys(preloadedChartData).join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Flight Hours Distribution</h3>

      <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours Distribution - {metricLabels[expandedMetric]}
          </h4>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center" style={{ minHeight: '256px' }}>
            <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <p>No chart data available for {metricLabels[expandedMetric]}</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <div className="w-full" style={{ height: '256px', minWidth: '400px', minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={400} minHeight={256}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                barCategoryGap={chartData.length === 1 ? '40%' : '20%'}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="range"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 11 }}
                />
                <YAxis
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  label={{ value: 'Hours (log scale)', angle: -90, position: 'insideLeft', fill: axisColor }}
                  scale="log"
                  domain={[0.001, 'auto']}
                  allowDataOverflow={false}
                  tickFormatter={(value) => value >= 1 ? value.toFixed(0) : value.toFixed(2)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '0.5rem',
                    color: tooltipText,
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}h`, 'Flight Hours']}
                  cursor={{ fill: `${metricColors[expandedMetric]}33` }}
                />
                <Bar
                  dataKey="hours"
                  fill={metricColors[expandedMetric] || '#3EC1C5'}
                  name="Flight Hours"
                  cursor="pointer"
                  onClick={handleBarClick}
                  maxBarSize={chartData.length === 1 ? 100 : undefined}
                  minPointSize={5}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Click on bars to filter the table by that range
        </div>
      </div>
    </div>
  );
}

