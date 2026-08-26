import React, { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, CheckCircle, XCircle, Clock, Database, ChevronDown, ChevronRight, Calendar, Settings, Plane, CloudSun, AlertTriangle, Box, Timer, FileText, Wifi } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from '../config/api';

// ── types ──────────────────────────────────────────────────────────────────

interface SyncConfig {
  container: string;
  cronSchedule: string;
  configured: boolean;
  flightFile: string;
  weatherFile: string;
}

interface BlobResult {
  blob: string;
  type: 'flight' | 'weather';
  rows: number;
  inserted: number;
  skipped: number;
  rowErrors: number;
  error?: string;
}

interface SyncRun {
  _id: string;
  triggeredBy: 'scheduler' | 'manual';
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  totalBlobsScanned: number;
  filesFound: number;
  inserted: number;
  skipped: number;
  rowErrors: number;
  blobs: BlobResult[];
  errorMessage: string | null;
  createdAt: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function cronHuman(expr: string) {
  if (expr === '0 2 * * *')   return 'Daily at 02:00 AM IST';
  if (expr === '0 * * * *')   return 'Every hour';
  if (expr === '*/30 * * * *') return 'Every 30 minutes';
  return expr;
}

const STATUS_COLOR: Record<string, string> = {
  running:   'text-blue-400',
  completed: 'text-green-400',
  failed:    'text-red-400',
};
const STATUS_BG: Record<string, string> = {
  running:   'bg-blue-400/10',
  completed: 'bg-green-400/10',
  failed:    'bg-red-400/10',
};

function StatusBadge({ status }: { status: string }) {
  const Icon = status === 'completed' ? CheckCircle : status === 'failed' ? XCircle : RefreshCw;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BG[status]}`}>
      <Icon className={`w-3 h-3 ${STATUS_COLOR[status]} ${status === 'running' ? 'animate-spin' : ''}`} />
      <span className={STATUS_COLOR[status]}>{status}</span>
    </span>
  );
}

// ── BlobTable: per-type table with S.No ────────────────────────────────────

function BlobTable({ blobs, type, isDark }: { blobs: BlobResult[]; type: 'flight' | 'weather'; isDark: boolean }) {
  const filtered = blobs.filter(b => b.type === type);
  if (filtered.length === 0) return <p className={`text-xs px-3 py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No {type} files.</p>;
  const totRows      = filtered.reduce((s, b) => s + (b.rows ?? 0), 0);
  const totInserted  = filtered.reduce((s, b) => s + b.inserted, 0);
  const totSkipped   = filtered.reduce((s, b) => s + b.skipped, 0);
  const totErrors    = filtered.reduce((s, b) => s + (b.rowErrors ?? 0), 0);
  const tfootCls     = `px-3 py-2 text-xs font-semibold tabular-nums border-t ${isDark ? 'border-gray-600' : 'border-gray-300'}`;
  const tfootRowCls  = isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700';
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className={isDark ? 'di-blob-thead-dark' : 'di-blob-thead-light'}>
          {['S.No', 'Blob Path', 'Rows', 'Inserted', 'Skipped', 'Errors'].map(h => (
            <th key={h} className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtered.map((b, i) => (
          <tr key={i} className={isDark ? 'di-blob-tr-dark' : 'di-blob-tr-light'}>
            <td className={`px-3 py-2 tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{i + 1}</td>
            <td className={`px-3 py-2 font-mono max-w-xs truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={b.blob}>{b.blob}</td>
            <td className={`px-3 py-2 tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{b.rows ?? '—'}</td>
            <td className="px-3 py-2 text-green-400 font-medium tabular-nums">{b.inserted}</td>
            <td className={`px-3 py-2 tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{b.skipped}</td>
            <td className={`px-3 py-2 tabular-nums ${(b.rowErrors ?? 0) > 0 || b.error ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {b.error
                ? <span className="inline-flex items-center gap-1" title={b.error}><AlertTriangle className="w-3 h-3" />{b.rowErrors ?? 0}</span>
                : (b.rowErrors ?? 0)
              }
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10">
        <tr className={tfootRowCls}>
          <td className={tfootCls} colSpan={2}>Total ({filtered.length} file{filtered.length !== 1 ? 's' : ''})</td>
          <td className={tfootCls}>{totRows}</td>
          <td className={`${tfootCls} text-green-400`}>{totInserted}</td>
          <td className={tfootCls}>{totSkipped}</td>
          <td className={`${tfootCls} ${totErrors > 0 ? 'text-red-400' : ''}`}>{totErrors}</td>
        </tr>
      </tfoot>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export function DataIngestionPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [config, setConfig]           = useState<SyncConfig | null>(null);
  const [runs, setRuns]               = useState<SyncRun[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [triggering, setTriggering]   = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const PAGE_SIZE = 15;
  const token = () => localStorage.getItem('auth_token');

  const fetchConfig = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/blob-sync/config`, { headers: { Authorization: `Bearer ${token()}` } });
      if (r.ok) setConfig(await r.json());
    } catch { /* silent */ }
  }, []);

  const fetchRuns = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/blob-sync/runs?page=${p}&limit=${PAGE_SIZE}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (r.ok) { const d = await r.json(); setRuns(d.runs); setTotal(d.total); }
    } finally { setLoading(false); }
  }, [page]);

  const pollRun = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/blob-sync/runs/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!r.ok) return;
      const run: SyncRun = await r.json();
      setRuns(prev => prev.map(x => x._id === id ? run : x));
      if (run.status !== 'running') { setActiveRunId(null); setTriggering(false); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchConfig(); fetchRuns(1); }, []);
  useEffect(() => { fetchRuns(page); }, [page]);
  useEffect(() => {
    if (!activeRunId) return;
    const id = setInterval(() => pollRun(activeRunId), 3000);
    return () => clearInterval(id);
  }, [activeRunId, pollRun]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const r = await fetch(`${API_BASE_URL}/blob-sync/trigger`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      const data = await r.json();
      if (!r.ok) { alert(data.message || 'Failed to start sync'); setTriggering(false); return; }
      setActiveRunId(data.runId);
      setTimeout(() => fetchRuns(1), 500);
    } catch (e: any) { alert(e.message); setTriggering(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const card = (icon: React.ReactNode, label: string, value: React.ReactNode, color = 'text-[#3EC1C5]') => (
    <div className={`di-stat-card ${isDark ? 'di-card-dark' : 'di-card-light'}`}>
      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <span className={color}>{icon}</span>{label}
      </div>
      <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  );

  const totals = runs.reduce((acc, r) => ({
    inserted:  acc.inserted  + r.inserted,
    skipped:   acc.skipped   + r.skipped,
    rowErrors: acc.rowErrors + (r.rowErrors ?? 0),
  }), { inserted: 0, skipped: 0, rowErrors: 0 });

  return (
    <div className="di-page">

      {/* ── Config Card ── */}
      <div className={`di-card ${isDark ? 'di-card-dark' : 'di-card-light'}`}>
        <div className="di-card-header">
          <h2 className={`di-section-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Settings className="w-4 h-4 text-[#3EC1C5]" />
            Blob Sync Configuration
          </h2>
          <button
            onClick={handleTrigger}
            disabled={triggering || !config?.configured}
            className={`di-btn-trigger ${triggering ? 'di-btn-trigger-busy' : isDark ? 'di-btn-trigger-dark' : 'di-btn-trigger-light'}`}
          >
            {triggering
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing…</>
              : <><Play className="w-4 h-4" /> Run Sync Now</>
            }
          </button>
        </div>

        {config ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: <Box className="w-4 h-4" />,      label: 'Container',     value: config.container,                color: 'text-[#3EC1C5]'  },
              { icon: <Timer className="w-4 h-4" />,    label: 'Cron Schedule', value: cronHuman(config.cronSchedule),  color: 'text-purple-400' },
              { icon: <Plane className="w-4 h-4" />,    label: 'Flight File',   value: config.flightFile,               color: 'text-indigo-400' },
              { icon: <CloudSun className="w-4 h-4" />, label: 'Weather File',  value: config.weatherFile,              color: 'text-blue-400'   },
              { icon: <Wifi className="w-4 h-4" />,     label: 'Status',        value: config.configured ? 'Connected' : 'Not configured', color: config.configured ? 'text-green-400' : 'text-red-400' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className={`di-stat-card ${isDark ? 'di-card-dark' : 'di-card-light'}`}>
                <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span className={color}>{icon}</span>{label}
                </div>
                <p className={`text-sm font-bold mt-1 truncate ${isDark ? 'text-white' : 'text-gray-900'}`} title={value}>{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading config…</p>
        )}

        {!config?.configured && (
          <div className={isDark ? 'di-alert-error-dark' : 'di-alert-error-light'}>
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span><strong>AZURE_STORAGE_CONNECTION_STRING</strong> is not set in the server environment. Add it to <code>server/.env</code> to enable sync.</span>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {card(<Database className="w-4 h-4" />,    'Total Runs',       total)}
        {card(<CheckCircle className="w-4 h-4" />, 'Records Inserted', totals.inserted,  'text-green-400')}
        {card(<Clock className="w-4 h-4" />,       'Records Skipped',  totals.skipped,   'text-yellow-400')}
        {card(<XCircle className="w-4 h-4" />,     'Row Errors',       totals.rowErrors, 'text-red-400')}
      </div>

      {/* ── Run History ── */}
      <div className={`di-table-wrap ${isDark ? 'di-table-wrap-dark' : 'di-table-wrap-light'}`}>
        <div className={`di-table-header ${isDark ? 'di-table-header-dark' : 'di-table-header-light'}`}>
          <h2 className={`di-section-title text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Calendar className="w-4 h-4 text-[#3EC1C5]" />
            Sync History
          </h2>
          <button
            onClick={() => { fetchRuns(page); fetchConfig(); }}
            className={`di-btn-refresh ${isDark ? 'di-btn-refresh-dark' : 'di-btn-refresh-light'}`}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="min-w-max w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className={isDark ? 'di-thead-row-dark' : 'di-thead-row-light'}>
                {['#', 'Status', 'Triggered By', 'Files Found', 'Inserted', 'Skipped', 'Errors', 'Duration', 'Started'].map(h => (
                  <th key={h} className={`di-th ${isDark ? 'di-th-dark' : 'di-th-light'}`}>{h}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="py-12 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-40" />
                  <p className="text-xs opacity-40">Loading…</p>
                </td></tr>
              )}
              {!loading && runs.length === 0 && (
                <tr><td colSpan={10} className="py-16 text-center">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No sync runs yet. Click "Run Sync Now" to start.</p>
                </td></tr>
              )}
              {!loading && runs.map((run, idx) => {
                const prevExpanded = idx > 0 && expandedRun === runs[idx - 1]._id;
                return (
                <React.Fragment key={run._id}>
                  <tr
                    onClick={() => setExpandedRun(expandedRun === run._id ? null : run._id)}
                    className={`cursor-pointer transition ${
                      prevExpanded ? '' : 'border-t'
                    } ${
                      expandedRun === run._id
                        ? isDark ? 'di-tr-expanded-dark' : 'di-tr-expanded-light'
                        : isDark ? 'di-tr-normal-dark' : 'di-tr-normal-light'
                    }`}
                  >
                    <td className={`px-4 py-3 text-xs tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className={`px-4 py-3 text-xs capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{run.triggeredBy}</td>
                    <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{run.filesFound}</td>
                    <td className="px-4 py-3 text-xs text-green-400 font-medium">{run.inserted}</td>
                    <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{run.skipped}</td>
                    <td className={`px-4 py-3 text-xs ${(run.rowErrors ?? 0) > 0 ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>{run.rowErrors ?? 0}</td>
                    <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fmtDuration(run.durationMs)}</td>
                    <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fmtDate(run.startTime)}</td>
                    <td className="px-4 py-3">
                      {expandedRun === run._id
                        ? <ChevronDown className="w-4 h-4 opacity-40" />
                        : <ChevronRight className="w-4 h-4 opacity-40" />
                      }
                    </td>
                  </tr>

                  {/* ── Expanded detail ── no border-t to avoid white line */}
                  {expandedRun === run._id && (
                    <tr className={isDark ? 'di-detail-row-dark' : 'di-detail-row-light'} style={{ borderTop: 'none' }}>
                      <td colSpan={10} className="px-6 py-4 space-y-3">

                        {run.errorMessage && (
                          <div className={isDark ? 'di-alert-error-dark' : 'di-alert-error-light'}>
                            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            {run.errorMessage}
                          </div>
                        )}
                        {run.status === 'running' && (
                          <div className={isDark ? 'di-alert-info-dark' : 'di-alert-info-light'}>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Sync in progress — scanning blob container…
                          </div>
                        )}

                        {/* Discovery summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            ['Blobs Scanned',  run.totalBlobsScanned ?? '—', isDark ? 'text-gray-300' : 'text-gray-700'],
                            ['Parquet Files',  run.filesFound,               'text-[#3EC1C5]'],
                            ['Flight Files',   run.blobs.filter(b => b.type === 'flight').length,  'text-purple-400'],
                            ['Weather Files',  run.blobs.filter(b => b.type === 'weather').length, 'text-blue-400'],
                          ].map(([label, val, color]) => (
                            <div key={label as string} className={isDark ? 'di-mini-tile-dark' : 'di-mini-tile-light'}>
                              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                              <p className={`text-sm font-bold ${color}`}>{val}</p>
                            </div>
                          ))}
                        </div>

                        {/* Flight vs Weather diff */}
                        {run.blobs.length > 0 && (
                          <div className="space-y-2">
                            <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Processed Files ({run.blobs.length})
                            </p>
                            <div className="di-diff-grid">
                              {/* Flight */}
                              <div className={isDark ? 'di-diff-box-dark' : 'di-diff-box-light'}>
                                <p className={`flex items-center gap-1.5 ${isDark ? 'di-diff-header-flight-dark' : 'di-diff-header-flight-light'}`}>
                                  <Plane className="w-3 h-3" /> Flight Files ({run.blobs.filter(b => b.type === 'flight').length})
                                </p>
                                <div className="max-h-48 overflow-y-auto">
                                  <BlobTable blobs={run.blobs} type="flight" isDark={isDark} />
                                </div>
                              </div>
                              {/* Weather */}
                              <div className={isDark ? 'di-diff-box-dark' : 'di-diff-box-light'}>
                                <p className={`flex items-center gap-1.5 ${isDark ? 'di-diff-header-weather-dark' : 'di-diff-header-weather-light'}`}>
                                  <CloudSun className="w-3 h-3" /> Weather Files ({run.blobs.filter(b => b.type === 'weather').length})
                                </p>
                                <div className="max-h-48 overflow-y-auto">
                                  <BlobTable blobs={run.blobs} type="weather" isDark={isDark} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {run.blobs.length === 0 && (
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {run.status === 'running' ? 'Waiting for results…' : 'No blob details recorded.'}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className={`di-pagination ${isDark ? 'di-pagination-dark' : 'di-pagination-light'}`}>
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className={`di-page-btn ${isDark ? 'di-page-btn-dark' : 'di-page-btn-light'}`}>
                Previous
              </button>
              <span className="px-2 py-1">Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className={`di-page-btn ${isDark ? 'di-page-btn-dark' : 'di-page-btn-light'}`}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
