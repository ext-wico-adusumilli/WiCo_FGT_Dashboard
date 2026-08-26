import { useState, useEffect, useMemo } from 'react';
import { FileText, ArrowBigRight, Zap, ArrowBigLeft } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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

interface TransitionDistanceDashboardProps {
  onMetricClick?: (metric: 'forward' | 'backward' | null) => void;
  expandedMetric?: 'forward' | 'backward' | null;
  dateRange?: { start: string | null; end: string | null };
  transitionData?: TransitionEntry[];
  loading?: boolean;
}

export function TransitionDistanceDashboard({
  onMetricClick,
  expandedMetric,
  dateRange = { start: null, end: null },
  transitionData = [],
  loading = false
}: TransitionDistanceDashboardProps) {
  const { theme } = useTheme();

  const stats = useMemo(() => {
    const totalBranches = transitionData.length;
    
    // Use actual min/max values from the data, not from mean
    const forwardMinValues = transitionData
      .filter(e => e.forwardMin !== null)
      .map(e => e.forwardMin!);
    const forwardMaxValues = transitionData
      .filter(e => e.forwardMax !== null)
      .map(e => e.forwardMax!);
    const minForwardDistance = forwardMinValues.length > 0 ? Math.min(...forwardMinValues) : 0;
    const maxForwardDistance = forwardMaxValues.length > 0 ? Math.max(...forwardMaxValues) : 0;
    
    const backwardMinValues = transitionData
      .filter(e => e.backwardMin !== null)
      .map(e => e.backwardMin!);
    const backwardMaxValues = transitionData
      .filter(e => e.backwardMax !== null)
      .map(e => e.backwardMax!);
    const minBackwardDistance = backwardMinValues.length > 0 ? Math.min(...backwardMinValues) : 0;
    const maxBackwardDistance = backwardMaxValues.length > 0 ? Math.max(...backwardMaxValues) : 0;
    
    const totalForwardTransitions = transitionData.reduce((sum, e) => sum + (e.totalForward ?? 0), 0);
    const totalBackwardTransitions = transitionData.reduce((sum, e) => sum + (e.totalBackward ?? 0), 0);

    return {
      totalBranches,
      minForwardDistance,
      maxForwardDistance,
      minBackwardDistance,
      maxBackwardDistance,
      totalForwardTransitions,
      totalBackwardTransitions,
    };
  }, [transitionData]);

  const statCards = [
    {
      icon: <FileText className="w-6 h-6" />,
      label: 'Airfields',
      value: stats.totalBranches.toString(),
      color: 'text-[#3EC1C5]',
      clickable: false,
    },
    {
      icon: <ArrowBigRight className="w-6 h-6" />,
      label: 'Forward Distance',
      color: 'text-teal-400',
      clickable: false,
      showMinMax: true,
      minValue: `Min: ${stats.minForwardDistance.toFixed(2)} m`,
      maxValue: `Max: ${stats.maxForwardDistance.toFixed(2)} m`,
      metricType: 'forward' as const,
    },
    {
      icon: <ArrowBigLeft className="w-6 h-6" />,
      label: 'Backward Distance',
      color: 'text-violet-400',
      clickable: false,
      showMinMax: true,
      minValue: `Min: ${stats.minBackwardDistance.toFixed(2)} m`,
      maxValue: `Max: ${stats.maxBackwardDistance.toFixed(2)} m`,
      metricType: 'backward' as const,
    },
    {
      icon: <Zap className="w-6 h-6" />,
      label: 'Total Transitions (FWD + BWD)',
      value: `${stats.totalForwardTransitions + stats.totalBackwardTransitions}`,
      color: 'text-pink-400',
      clickable: false,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`rounded-lg p-3 sm:p-4 h-24 border ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, idx) => {
          const isExpanded = stat.metricType && expandedMetric === stat.metricType;
          return (
            <div
              key={idx}
              onClick={() => {
                if (stat.clickable && stat.metricType && onMetricClick) {
                  onMetricClick(isExpanded ? null : stat.metricType);
                }
              }}
              className={`border rounded-lg p-3 sm:p-4 text-left relative transition ${
                theme === 'dark' 
                  ? 'bg-gray-800' 
                  : 'bg-white'
              } ${
                stat.clickable 
                  ? theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-900'
                  : ''
              } ${
                isExpanded 
                  ? theme === 'dark'
                    ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                    : 'border-gray-900 ring-2 ring-gray-900/50'
                  : theme === 'dark'
                    ? 'border-gray-700'
                    : 'border-gray-300'
              }`}
            >
              {/* {stat.showMinMax && (
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <div className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-medium rounded text-center">
                    {stat.minValue}
                  </div>
                  <div className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-medium rounded text-center">
                    {stat.maxValue}
                  </div>
                </div>
              )} */}
              
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
              {!stat.showMinMax && (
                <p className={`text-xl sm:text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
              )}
              {stat.showMinMax && (
                <div className="mt-2 space-y-1">
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Range: <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.minValue}</span> - <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.maxValue}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

