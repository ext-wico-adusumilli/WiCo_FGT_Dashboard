import { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { useTheme } from '../../contexts/ThemeContext';

interface BatteryEntry {
  _id: string;
  batterySN: string;
  flights: number;
  cycleCount: number;
  peakTemperature: number;
}

interface BatteryChartProps {
  entries: BatteryEntry[];
}

export function BatteryChart({ entries }: BatteryChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const { theme } = useTheme();

  useLayoutEffect(() => {
    if (!chartRef.current) return;

    // Create root element
    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;

    // Remove amCharts watermark
    root._logo?.dispose();

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Theme colors
    const textColor = theme === 'dark' ? 0xffffff : 0x1f2937;
    const gridColor = theme === 'dark' ? 0xffffff : 0x000000;
    const gridOpacity = theme === 'dark' ? 0.2 : 0.1;

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
      fill: am5.color(textColor),
    });

    // Process data - sort by flights to show most used batteries
    const sortedEntries = [...entries]
      .sort((a, b) => b.flights - a.flights)
      .slice(0, 10); // Top 10 batteries by flight count

    const data = sortedEntries.map(entry => ({
      batterySN: entry.batterySN,
      flights: entry.flights,
      cycleCount: entry.cycleCount,
      peakTemperature: entry.peakTemperature,
    }));

    // Create axes
    const xRenderer = am5xy.AxisRendererX.new(root, {
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
      minorGridEnabled: true,
    });

    // Style x-axis grid and labels
    xRenderer.grid.template.setAll({
      location: 1,
      stroke: am5.color(gridColor),
      strokeOpacity: gridOpacity,
    });

    xRenderer.labels.template.setAll({
      fill: am5.color(textColor),
      fontSize: 9,
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p100,
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'batterySN',
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    xAxis.data.setAll(data);

    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1,
    });

    // Style y-axis grid and labels
    yRenderer.grid.template.setAll({
      stroke: am5.color(gridColor),
      strokeOpacity: gridOpacity,
    });

    yRenderer.labels.template.setAll({
      fill: am5.color(textColor),
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
      })
    );

    // Add series for Flights
    const flightsSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'No. of Flights',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'flights',
        categoryXField: 'batterySN',
        fill: am5.color(0x60a5fa),
        stroke: am5.color(0x60a5fa),
      })
    );

    flightsSeries.columns.template.setAll({
      tooltipText: 'Battery {categoryX}: {valueY} flights',
      width: am5.percent(80),
      tooltipY: 0,
      strokeOpacity: 0,
    });

    flightsSeries.data.setAll(data);
    flightsSeries.appear();

    flightsSeries.bullets.push(function () {
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

    legend.data.push(flightsSeries);

    // Add series for Cycle Count
    const cycleSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Cycle Count',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'cycleCount',
        categoryXField: 'batterySN',
        stroke: am5.color(0xfbbf24),
        fill: am5.color(0xfbbf24),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    cycleSeries.strokes.template.setAll({
      strokeWidth: 2,
      tooltipText: 'Cycle Count, {categoryX}: {valueY}',
    });

    cycleSeries.bullets.push(function () {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 4,
          fill: cycleSeries.get('fill'),
          tooltipText: 'Cycle Count, {categoryX}: {valueY}',
        }),
      });
    });

    cycleSeries.data.setAll(data);
    cycleSeries.appear();

    legend.data.push(cycleSeries);

    // Add series for Peak Temperature
    const tempSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Peak Temperature (°C)',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'peakTemperature',
        categoryXField: 'batterySN',
        stroke: am5.color(0xf87171),
        fill: am5.color(0xf87171),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    tempSeries.strokes.template.setAll({
      strokeWidth: 2,
      strokeDasharray: [3, 3],
      tooltipText: 'Peak Temp, {categoryX}: {valueY}°C',
    });

    tempSeries.bullets.push(function () {
      return am5.Bullet.new(root, {
        sprite: am5.Triangle.new(root, {
          width: 8,
          height: 8,
          fill: tempSeries.get('fill'),
          tooltipText: 'Peak Temp, {categoryX}: {valueY}°C',
        }),
      });
    });

    tempSeries.data.setAll(data);
    tempSeries.appear();

    legend.data.push(tempSeries);

    // Make stuff animate on load
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [entries, theme]);

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Battery Performance Overview</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4">
      <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Battery Performance Overview</h2>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}

