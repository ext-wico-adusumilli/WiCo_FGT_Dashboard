import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className={`max-w-md w-full text-center space-y-6 p-8 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex justify-center">
          <div className={`p-4 rounded-full ${
            theme === 'dark' 
              ? 'bg-red-500/20' 
              : 'bg-red-100'
          }`}>
            <ShieldOff className={`w-16 h-16 ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`} />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Access Denied
          </h1>
          <p className={`text-lg ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            You don't have permission to access this page
          </p>
        </div>

        <div className={`p-4 rounded-lg ${
          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
        }`}>
          <p className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            If you believe this is an error, please contact your administrator to request access to this module.
          </p>
        </div>

        <button
          onClick={() => navigate(-1)}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
            theme === 'dark'
              ? 'bg-[#3EC1C5] hover:bg-[#35a9ad] text-gray-900'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>
      </div>
    </div>
  );
}
