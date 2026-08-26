import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: ToastMessage = { id, message, type };

    setToasts((prev) => [...prev, toast]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md w-full px-4">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const { theme } = useTheme();
  
  const getBgColor = () => {
    if (theme === 'dark') {
      return toast.type === 'success' ? 'bg-green-500/10 border-green-500/30' : 
             toast.type === 'error' ? 'bg-red-500/10 border-red-500/30' : 
             'bg-blue-500/10 border-blue-500/30';
    } else {
      return toast.type === 'success' ? 'bg-green-50 border-green-200' : 
             toast.type === 'error' ? 'bg-red-50 border-red-200' : 
             'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = () => {
    if (theme === 'dark') {
      return toast.type === 'success' ? 'text-green-400' : 
             toast.type === 'error' ? 'text-red-400' : 
             'text-blue-400';
    } else {
      return toast.type === 'success' ? 'text-green-700' : 
             toast.type === 'error' ? 'text-red-700' : 
             'text-blue-700';
    }
  };

  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : Info;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${getBgColor()} animate-in fade-in slide-in-from-right duration-300`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${getTextColor()}`} />
      <div className="flex-1">
        <p className={`text-sm font-medium ${getTextColor()} whitespace-pre-line`}>{toast.message}</p>
      </div>
      <button onClick={() => onRemove(toast.id)} className={`flex-shrink-0 ${getTextColor()} hover:opacity-80 transition-opacity`}>
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

