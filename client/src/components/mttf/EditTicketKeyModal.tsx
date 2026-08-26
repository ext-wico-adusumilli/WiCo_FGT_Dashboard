import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { X, Save, AlertCircle } from 'lucide-react';

interface EditTicketKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  onSave: (newKey: string) => Promise<void>;
}

export function EditTicketKeyModal({ isOpen, onClose, currentKey, onSave }: EditTicketKeyModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [ticketKey, setTicketKey] = useState(currentKey);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTicketKey(currentKey);
    setError(null);
  }, [currentKey, isOpen]);

  const validateTicketKey = (key: string): boolean => {
    const pattern = /^[A-Z]+-\d+$/;
    return pattern.test(key);
  };

  const handleSave = async () => {
    setError(null);

    if (!ticketKey.trim()) {
      setError('Ticket key cannot be empty');
      return;
    }

    if (!validateTicketKey(ticketKey.trim())) {
      setError('Invalid format. Use: PROJECT-123');
      return;
    }

    setSaving(true);
    try {
      await onSave(ticketKey.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed flex items-center justify-center p-4 bg-black/30 backdrop-blur-md"
      style={{
        top: '-100px',
        left: '-100px',
        right: '-100px',
        bottom: '-100px',
        zIndex: 10000,
        width: 'calc(100vw + 200px)',
        height: 'calc(100vh + 200px)',
        margin: 0,
        padding: '100px'
      }}
    >
      <div
        className={`w-full max-w-md rounded-lg shadow-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Edit Parent Ticket Key
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition ${isDark
              ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label
              htmlFor="ticketKey"
              className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
            >
              Parent Ticket Key
            </label>
            <input
              id="ticketKey"
              type="text"
              value={ticketKey}
              onChange={(e) => setTicketKey(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g., PROJECT-123"
              className={`w-full px-3 py-2 border rounded-lg transition focus:outline-none focus:ring-2 ${error
                ? 'border-red-500 focus:ring-red-500'
                : isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-gray-900'
                }`}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <button
            onClick={onClose}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              } disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${isDark
              ? 'bg-[#3EC1C5] hover:bg-[#35a8ac] text-white'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
              } disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
