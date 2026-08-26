import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}: ConfirmDialogProps) {
  const { theme } = useTheme();
  
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-500',
          button: 'bg-red-500 hover:bg-red-600 text-white'
        };
      case 'warning':
        return {
          icon: theme === 'light' ? 'text-gray-600' : 'text-gray-400',
          button: theme === 'light' 
            ? 'bg-gray-900 hover:bg-gray-800 text-white' 
            : 'bg-gray-600 hover:bg-gray-500 text-white'
        };
      case 'info':
        return {
          icon: theme === 'light' ? 'text-gray-600' : 'text-gray-400',
          button: theme === 'light' 
            ? 'bg-gray-900 hover:bg-gray-800 text-white' 
            : 'bg-gray-600 hover:bg-gray-500 text-white'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={`relative rounded-xl p-6 max-w-md w-full shadow-2xl ${
        theme === 'light'
          ? 'bg-white border border-gray-200'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1 rounded-md transition ${
            theme === 'light'
              ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 ${styles.icon} mt-0.5`}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="flex-1">
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              {title}
            </h3>
            <p className={`text-sm mb-6 ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-300'
            }`}>
              {message}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
                  theme === 'light'
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`px-4 py-2 rounded-lg transition text-sm font-medium ${styles.button}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

