import { useTheme } from '../contexts/ThemeContext';

export function MTTFDashboardSkeleton() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="space-y-4 sm:space-y-5 animate-pulse">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className={`border rounded-lg p-3 sm:p-4 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className={`w-6 h-6 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className={`h-3 rounded w-24 mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className={`h-7 rounded w-16 mt-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          </div>
        ))}
      </div>

      {/* Bottom Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Recent Entries Skeleton */}
        <div className={`border rounded-lg p-3 sm:p-4 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className={`h-5 rounded w-32 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${
                isDark ? 'bg-gray-700/50' : 'bg-gray-100'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className={`h-4 rounded w-32 mb-1 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                  <div className={`h-3 rounded w-24 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                </div>
                <div className="flex flex-col items-end ml-2 gap-1">
                  <div className={`h-5 rounded w-16 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                  <div className={`h-3 rounded w-20 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Distribution Skeleton */}
        <div className={`border rounded-lg p-3 sm:p-4 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className={`h-5 rounded w-40 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className={`h-4 rounded w-24 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                <div className="flex items-center gap-2">
                  <div className={`w-24 rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  <div className={`h-4 rounded w-8 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

