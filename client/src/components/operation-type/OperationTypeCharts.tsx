import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { useTheme } from '../../contexts/ThemeContext';
import { API_BASE_URL } from '../../config/api';

interface OperationTypeChartsProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
}

interface OperationTypeData {
  operationType: string;
  numFlights: number;
  avgDuration: number;
  totalDuration: number;
  totalFlightHours: number;
  totalDistance: number;
  totalTransitions: number;
}

export function OperationTypeCharts({
  selectedSNs = [],
  dateRange = { start: null, end: null }
}: OperationTypeChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OperationTypeData[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedSNs, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();

      if (selectedSNs.length > 0) {
        params.append('sns', selectedSNs.join(','));
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }

      const response = await fetch(
        `${API_BASE_URL}/operation-type/analysis?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Filter out operation types with 0 flights
        const filteredData = result.filter((item: OperationTypeData) => item.numFlights > 0);
        setData(filteredData);
      }
    } catch (error) {
      console.error('Error fetching operation type analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    if (!chartRef.current || loading || data.length === 0) return;

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;

    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const textColor = isDark ? 0xffffff : 0x1f2937;
    const gridColor = isDark ? 0xffffff : 0x000000;
    const gridOpacity = isDark ? 0.2 : 0.1;

    // Create chart with zoom and pan enabled
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'zoomX',
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 20
      })
    );

    // Add cursor for better interactivity
    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, {
      behavior: 'zoomX'
    }));
    cursor.lineY.set('visible', false);

    // Create X-axis (Operation Types)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 30,
      minorGridEnabled: true
    });

    xRenderer.grid.template.setAll({
      stroke: am5.color(gridColor),
      strokeOpacity: gridOpacity
    });

    xRenderer.labels.template.setAll({
      fill: am5.color(textColor),
      fontSize: 10,
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p100
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'operationType',
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    xAxis.data.setAll(data);

    // Create Y-axis (Flight Duration in minutes)
    const yRenderer = am5xy.AxisRendererY.new(root, {});
    yRenderer.grid.template.setAll({
      stroke: am5.color(gridColor),
      strokeOpacity: gridOpacity
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(textColor),
      fontSize: 11
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer
      })
    );

    // Average Duration Series (Bar Chart)
    // create tooltip first and make its background/marker transparent
    const avgDurationTooltip = am5.Tooltip.new(root, {
      pointerOrientation: "vertical",
      labelHTML: `
        <div style="
          background: ${isDark ? 'rgba(31, 41, 55, 0.98)' : 'rgba(255, 255, 255, 0.98)'};
          border: 1px solid ${isDark ? 'rgba(75, 85, 99, 0.8)' : 'rgba(209, 213, 219, 0.8)'};
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          min-width: 280px;
        ">
          <div style="
            font-weight: 600;
            font-size: 13px;
            color: ${isDark ? '#3EC1C5' : '#1f2937'};
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid ${isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(209, 213, 219, 0.5)'};
          ">{categoryX}</div>
          
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${isDark ? '#9ca3af' : '#6b7280'};">Flight Hours (VLOS & BVLOS):</span>
              <span style="color: ${isDark ? '#ffffff' : '#1f2937'}; font-weight: 500; margin-left: 12px;">{totalFlightHours} hrs</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${isDark ? '#9ca3af' : '#6b7280'};">Flight Distance (VLOS & BVLOS):</span>
              <span style="color: ${isDark ? '#ffffff' : '#1f2937'}; font-weight: 500; margin-left: 12px;">{totalDistance} km</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${isDark ? '#9ca3af' : '#6b7280'};">Number of Flights:</span>
              <span style="color: ${isDark ? '#ffffff' : '#1f2937'}; font-weight: 500; margin-left: 12px;">{numFlights}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${isDark ? '#9ca3af' : '#6b7280'};">Number of Transitions:</span>
              <span style="color: ${isDark ? '#ffffff' : '#1f2937'}; font-weight: 500; margin-left: 12px;">{totalTransitions}</span>
            </div>
            
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 6px;
              padding-top: 8px;
              border-top: 1px solid ${isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(209, 213, 219, 0.5)'};
            ">
              <span style="color: ${isDark ? '#9ca3af' : '#6b7280'};">Avg Duration:</span>
              <span style="color: #3EC1C5; font-weight: 600; margin-left: 12px;">{valueY} mins</span>
            </div>
          </div>
        </div>
      `
    });

    // make tooltip background / stroke transparent so it doesn't pick up series color
    // NOTE: am5.color() is typed to accept a single argument, so use opacity props for transparency
    avgDurationTooltip.get("background")?.setAll({
      fill: am5.color(0x000000),
      stroke: am5.color(0x000000),
      fillOpacity: 0,
      strokeOpacity: 0
    });

    // tooltip often shows a small marker (colored square) — make it transparent/hidden too
    // cast to any so TS doesn't enforce the limited keyof ITooltipSettings check
    const ttMarker = (avgDurationTooltip as any).get?.("marker");
    if (ttMarker) {
      ttMarker.setAll?.({
        visible: false,
        forceHidden: true,
        fillOpacity: 0,
        strokeOpacity: 0
      });
    }

    // now create the series and assign the tooltip
    const avgDurationSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Avg Flight Duration (mins)",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "avgDuration",
        categoryXField: "operationType",
        tooltip: avgDurationTooltip // attach the tooltip instance we configured
      })
    );

    // style the actual columns (bars) on the template so their color does not change
    avgDurationSeries.columns.template.setAll({
      fill: am5.color(0x3EC1C5),   // keep the bar fill color
      stroke: am5.color(0x3EC1C5), // keep the bar stroke color
      strokeWidth: 1
    });

    avgDurationSeries.columns.template.setAll({
      width: am5.percent(70),
      strokeOpacity: 0,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      tooltipY: 0
    });

    // Add hover effect
    avgDurationSeries.columns.template.states.create('hover', {
      fill: am5.color(0x35a9ad),
      stroke: am5.color(0x35a9ad)
    });

    // Add data labels on bars
    avgDurationSeries.bullets.push(() => {
      return am5.Bullet.new(root, {
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: '{valueY}',
          fill: am5.color(textColor),
          centerY: am5.p100,
          centerX: am5.p50,
          populateText: true,
          fontSize: 10,
          dy: -5
        })
      });
    });

    avgDurationSeries.data.setAll(data);

    // Add scrollbar
    chart.set('scrollbarX', am5.Scrollbar.new(root, {
      orientation: 'horizontal'
    }));

    // Animate on load
    avgDurationSeries.appear(500);
    chart.appear(500, 50);

    return () => {
      root.dispose();
    };
  }, [data, loading, isDark]);

  if (loading) {
    return (
      <div className={`border rounded-lg p-3 sm:p-4 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
      }`}>
        <div className="animate-pulse space-y-3">
          <div className={`h-4 rounded w-48 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          <div className={`h-80 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`border rounded-lg p-4 sm:p-6 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
      }`}>
        <p className={`text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          No operation type data available for the selected filters
        </p>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 sm:p-4 ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
    }`}>
      <h2 className={`text-base sm:text-lg font-semibold mb-3 ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}>Flight Duration by Operation Type</h2>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}
