import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { API_BASE_URL } from '../../config/api';
import { Search, AlertCircle, Plane } from 'lucide-react';
import { ExcelExport } from '../ExcelExport';
import { MultiSelect } from '../MultiSelect';
import { CustomSelect } from '../CustomSelect';

const ALL_COMPONENTS: Record<string, string[]> = {
  Motor: ['Motor 1','Motor 2','Motor 3','Motor 4','Motor 5','Motor 6','Motor 7','Motor 8'],
  ESC: ['ESC 1','ESC 2','ESC 3','ESC 4','ESC 5','ESC 6','ESC 7','ESC 8'],
  Propeller: ['Prop M1','Prop M2','Prop M3','Prop M4','Prop M5','Prop M6','Prop M7','Prop M8'],
  Battery: ['Battery','Battery Pack'],
  Controller: ['Flight Controller','FC','Controller'],
  Sensor: ['Sensor','GPS','IMU','Barometer'],
  Actuator: ['Actuator','Servo'],
  Structure: ['Airframe','Structure','Frame'],
};

const SN_MTSP: Record<string, { sn: string; mtsp: string }> = {
  'SN35 - MTSP-52':  { sn: 'SN35',  mtsp: 'MTSP-52'   },
  'SN51 - MTSP-61':  { sn: 'SN51',  mtsp: 'MTSP-61'   },
  'SN58 - MTSP-68':  { sn: 'SN58',  mtsp: 'MTSP-68'   },
  'SN127 - MTSP-1599': { sn: 'SN127', mtsp: 'MTSP-1599' },
};

const TASK_TYPES: Record<string, string> = {
  '1': 'Replacement',
  '2': 'Repair',
  '3': 'Maintenance',
};

interface JiraIssue {
  key: string;
  id: string;
  issueType: string;
  summary: string;
  status: string;
  created: string;
  updated: string;
  dueDate: string | null;
  componentTask: string | null;
  completionDate: string | null;
  affectedComponent: string | null;
  offComponentPN: string | null;
  offComponentSN: string | null;
  onComponentPN: string | null;
  onComponentSN: string | null;
}

interface FlightData {
  date: string;       // dd-mm-yy
  totalDuration: number;
  cumulativeDuration: number;
}

// Overview per category: comp -> sorted dates
interface CategoryOverview {
  categoryName: string;
  components: string[];
  // comp -> list of { date, duration, compChangeDuration }
  data: Record<string, Array<{ date: string; duration: number | ''; compChangeDuration: number | '' }>>;
  maxLen: number;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const formats = [
    { re: /^(\d{2})-(\d{2})-(\d{4}), (\d{2}):(\d{2})$/, fn: (m: RegExpMatchArray) => new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]) },
    { re: /^(\d{4})-(\d{2})-(\d{2})/, fn: (m: RegExpMatchArray) => new Date(+m[1], +m[2]-1, +m[3]) },
    { re: /^(\d{2})-(\d{2})-(\d{2})$/, fn: (m: RegExpMatchArray) => { const y = +m[3]; return new Date(y < 50 ? 2000+y : 1900+y, +m[2]-1, +m[1]); } },
    { re: /^(\d{2})-(\d{2})-(\d{4})$/, fn: (m: RegExpMatchArray) => new Date(+m[3], +m[2]-1, +m[1]) },
  ];
  for (const { re, fn } of formats) {
    const m = s.match(re);
    if (m) return fn(m);
  }
  // fallback: ISO
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateOnly(s: string | null): string {
  if (!s) return '-';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  } catch { return s; }
}

function fmtISO(s: string | null): string {
  if (!s) return '-';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}, ${hh}:${min}:${ss}`;
  } catch { return s; }
}

function fmtDMY(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

function buildOverview(
  issues: JiraIssue[],
  compList: string[],
  categoryName: string,
  flightDates: Date[],       // sorted array of Date objects
  flightCumulative: number[], // parallel cumulative durations
  firstCumulative: number
): CategoryOverview | null {
  // binary search: find cumulative duration at or before a given date
  const getDuration = (dt: Date): number | '' => {
    let lo = 0, hi = flightDates.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (flightDates[mid] <= dt) { idx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return idx >= 0 ? flightCumulative[idx] : '';
  };

  const raw: Record<string, Date[]> = {};
  for (const comp of compList) raw[comp] = [];

  for (const issue of issues) {
    const comp = issue.affectedComponent;
    const dateStr = issue.completionDate;
    if (comp && comp in raw && dateStr) {
      const parsed = parseDate(dateStr);
      if (parsed) raw[comp].push(parsed);
    }
  }

  for (const comp of compList) raw[comp].sort((a, b) => a.getTime() - b.getTime());

  const maxLen = Math.max(...compList.map(c => raw[c].length));
  if (maxLen === 0) return null;

  const data: CategoryOverview['data'] = {};
  for (const comp of compList) {
    data[comp] = raw[comp].map(dt => {
      const dur = getDuration(dt);
      const compChange = typeof dur === 'number' ? parseFloat((dur - firstCumulative).toFixed(2)) : '';
      return { date: fmtDMY(dt), duration: dur, compChangeDuration: compChange };
    });
  }

  return { categoryName, components: compList, data, maxLen };
}

export function FlightTimeAnalysis() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedAircraft, setSelectedAircraft] = useState<string>('SN35 - MTSP-52');
  const [taskType, setTaskType] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // raw data
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [flightSummary, setFlightSummary] = useState<FlightData[]>([]);
  const [firstFlight, setFirstFlight] = useState<FlightData | null>(null);
  const [overviews, setOverviews] = useState<CategoryOverview[]>([]);
  const [activeTab, setActiveTab] = useState<string>('details');

  const handleAnalyze = async () => {
    const aircraft = SN_MTSP[selectedAircraft];
    if (!aircraft) { setError('Please select an aircraft'); return; }
    const { sn, mtsp } = aircraft;
    const snNum = sn.replace('SN', '').replace(/^0+/, '');

    setLoading(true); setError(null);
    setIssues([]); setFlightSummary([]); setFirstFlight(null); setOverviews([]);

    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

      // 1. Flight summary from LogDetail
      const flightRes = await fetch(`${API_BASE_URL}/api/mttf/flight-time-analysis?sn=${snNum}`, { headers });
      if (!flightRes.ok) throw new Error('Failed to fetch flight time data');
      const flightResult = await flightRes.json();
      const summary: FlightData[] = flightResult.summary || [];
      setFlightSummary(summary);
      setFirstFlight(flightResult.firstFlight || null);

      // Build sorted parallel arrays for binary search
      const flightDates: Date[] = summary.map(r => {
        const [dd, mm, yy] = r.date.split('-').map(Number);
        return new Date(2000 + yy, mm - 1, dd);
      });
      const flightCumulative: number[] = summary.map(r => r.cumulativeDuration);
      const firstCumulative: number = summary.length > 0 ? summary[0].cumulativeDuration : 0;

      // 2. JIRA component replacements
      const jiraRes = await fetch(`${API_BASE_URL}/api/mttf/component-replacements`, {
        method: 'POST', headers,
        body: JSON.stringify({ parentTicket: mtsp, taskTypes: taskType.length > 0 ? taskType : undefined }),
      });
      if (!jiraRes.ok) {
        const err = await jiraRes.json().catch(() => ({}));
        throw new Error((err as any).message || 'Failed to fetch component replacement data');
      }
      const jiraResult = await jiraRes.json();
      const fetchedIssues: JiraIssue[] = jiraResult.replacements || [];
      setIssues(fetchedIssues);

      // 3. Build overviews with binary search + comp change duration
      const built: CategoryOverview[] = [];
      for (const [catName, compList] of Object.entries(ALL_COMPONENTS)) {
        const ov = buildOverview(fetchedIssues, compList, catName, flightDates, flightCumulative, firstCumulative);
        if (ov) built.push(ov);
      }
      setOverviews(built);
      setActiveTab('details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze data');
    } finally {
      setLoading(false);
    }
  };

  // ---- Excel export matching Python output ----
  const buildExcelSheets = () => {
    const sheets: any[] = [];

    // Details sheet
    if (issues.length > 0) {
      sheets.push({
        name: 'Details',
        data: issues.map((iss, i) => ({
          'S. No': i + 1,
          'Issue Type': iss.issueType || '',
          'Issue key': iss.key,
          'Issue id': iss.id,
          'Summary': iss.summary || '',
          'Status': iss.status || '',
          'Created': fmtISO(iss.created),
          'Updated': fmtISO(iss.updated),
          'Due date': fmtDateOnly(iss.dueDate),
          'Component task': iss.componentTask || '',
          'Affected or failed component': iss.affectedComponent || '',
          'Completion date': fmtDateOnly(iss.completionDate),
          'OFF COMPONENT PN': iss.offComponentPN || '',
          'OFF COMPONENT SN': iss.offComponentSN || '',
          'ON COMPONENT PN': iss.onComponentPN || '',
          'ON COMPONENT SN': iss.onComponentSN || '',
        })),
        columns: [
          'S. No','Issue Type','Issue key','Issue id','Summary','Status','Created','Updated','Due date',
          'Component task','Affected or failed component','Completion date',
          'OFF COMPONENT PN','OFF COMPONENT SN','ON COMPONENT PN','ON COMPONENT SN',
        ].map(k => ({ key: k, label: k })),
      });
    }

    // Overview sheets per category
    for (const ov of overviews) {
      const rows: any[] = [];

      if (firstFlight) {
        rows.push({ [ov.categoryName]: 'Date', _firstFlightDate: firstFlight.date, _firstFlightTotal: firstFlight.totalDuration, _firstFlightCumul: firstFlight.cumulativeDuration });
      }
      rows.push({});

      for (let i = 0; i < ov.maxLen; i++) {
        const row: any = { [ov.categoryName]: '' };
        for (const comp of ov.components) {
          const entry = ov.data[comp]?.[i];
          row[`${comp} - Date`] = entry?.date || '';
          row[`${comp} - Duration`] = entry !== undefined && entry.duration !== '' ? entry.duration : '';
          row[`${comp} - Comp Change Duration`] = entry !== undefined && entry.compChangeDuration !== '' ? entry.compChangeDuration : '';
        }
        rows.push(row);
      }

      const columns: any[] = [{ key: ov.categoryName, label: ov.categoryName }];
      for (const comp of ov.components) {
        columns.push({ key: `${comp} - Date`, label: `${comp} - Date` });
        columns.push({ key: `${comp} - Duration`, label: `${comp} - Duration` });
        columns.push({ key: `${comp} - Comp Change Duration`, label: `${comp} - Comp Change Duration` });
      }

      sheets.push({ name: `Overview_${ov.categoryName}`, data: rows, columns });
    }

    // Flight Summary sheet — named after the SN
    const snLabel = SN_MTSP[selectedAircraft]?.sn || 'SN';
    if (flightSummary.length > 0) {
      sheets.push({
        name: `Flight_Summary_${snLabel}`,
        data: flightSummary.map((r, i) => ({ 'S. No': i+1, 'Date': r.date, 'Total duration': r.totalDuration, 'Cumulative Duration': r.cumulativeDuration })),
        columns: ['S. No','Date','Total duration','Cumulative Duration'].map(k => ({ key: k, label: k })),
      });
    }

    return sheets;
  };

  const hasData = issues.length > 0 || flightSummary.length > 0;
  const allTabs = [
    { id: 'details', label: `Details (${issues.length})` },
    ...overviews.map(ov => ({ id: `ov_${ov.categoryName}`, label: `Overview_${ov.categoryName}` })),
    ...(flightSummary.length > 0 ? [{ id: 'flight', label: 'Flight Summary' }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`border rounded-lg p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center gap-2 mb-1">
          <Plane className="w-5 h-5 text-[#3EC1C5]" />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Flight Time Analysis</h2>
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Fetch JIRA component replacements and correlate with flight hours from log details.
        </p>
      </div>

      {/* Inputs */}
      <div className={`border rounded-lg p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
        <div className="flex flex-wrap items-end gap-3">
          {/* Aircraft selector */}
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Aircraft</label>
            <CustomSelect
              value={selectedAircraft}
              onChange={setSelectedAircraft}
              options={Object.keys(SN_MTSP).map(key => ({ value: key, label: key }))}
              placeholder="Select aircraft"
            />
          </div>

          {/* Task Type MultiSelect */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Task Type</label>
            <MultiSelect
              options={Object.values(TASK_TYPES).map(v => ({ value: v, label: v }))}
              value={taskType}
              onChange={setTaskType}
              placeholder="All task types"
            />
          </div>

          {/* Divider */}
          <div className={`hidden md:block self-stretch w-px mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

          {/* Actions */}
          <div className="flex items-center gap-2 pb-0.5">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-[#3EC1C5] hover:bg-[#35a8ac] text-gray-900' : 'bg-gray-900 hover:bg-gray-800 text-white'
              }`}
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /><span>Fetching...</span></>
                : <><Search className="w-4 h-4" /><span>Fetch</span></>
              }
            </button>
            {hasData && (
              <ExcelExport
                data={[]}
                filename={`jira_${SN_MTSP[selectedAircraft]?.sn}_${SN_MTSP[selectedAircraft]?.mtsp}_${new Date().toISOString().split('T')[0]}`}
                sheets={buildExcelSheets()}
                className="h-auto py-2 px-4 text-sm"
              />
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={`border rounded-lg p-4 ${isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-300'}`}>
          <div className="flex items-center gap-2 text-red-500"><AlertCircle className="w-5 h-5" /><span className="text-sm">{error}</span></div>
        </div>
      )}

      {/* Tabs */}
      {hasData && (
        <div className="space-y-3">
          <div className={`rounded-md p-0.5 inline-flex flex-wrap gap-0.5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
            {allTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition whitespace-nowrap ${activeTab === tab.id ? (isDark ? 'bg-[#3EC1C5] text-white' : 'bg-gray-900 text-white') : (isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200')}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className={`border rounded-lg overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className={`sticky top-0 uppercase ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-700'}`}>
                    <tr>
                      {['#','Issue Type','Issue Key','Summary','Status','Created','Updated','Due Date','Component Task','Affected Component','Completion Date','OFF PN','OFF SN','ON PN','ON SN'].map(h => (
                        <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'text-white' : 'text-gray-900'}>
                    {issues.map((iss, i) => (
                      <tr key={iss.key} className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <td className="px-3 py-2">{i+1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.issueType || '-'}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{iss.key}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={iss.summary}>{iss.summary || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.status || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtISO(iss.created)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtISO(iss.updated)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDateOnly(iss.dueDate)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.componentTask || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.affectedComponent || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDateOnly(iss.completionDate)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.offComponentPN || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.offComponentSN || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.onComponentPN || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.onComponentSN || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overview Tabs */}
          {overviews.map(ov => activeTab === `ov_${ov.categoryName}` && (
            <div key={ov.categoryName} className={`border rounded-lg overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
              {/* First flight info */}
              {firstFlight && (
                <div className={`px-4 py-2 text-xs border-b ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  First Flight — Date: <span className="font-semibold">{firstFlight.date}</span> &nbsp;|&nbsp;
                  Total Duration: <span className="font-semibold">{firstFlight.totalDuration}</span> hrs &nbsp;|&nbsp;
                  Cumulative: <span className="font-semibold">{firstFlight.cumulativeDuration}</span> hrs
                </div>
              )}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className={`sticky top-0 uppercase ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-700'}`}>
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap">S. No</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{ov.categoryName}</th>
                      {ov.components.map(comp => (
                        <React.Fragment key={comp}>
                          <th className="px-3 py-2 text-left whitespace-nowrap">{comp} - Date</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">{comp} - Duration</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">{comp} - Comp Change</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'text-white' : 'text-gray-900'}>
                    {Array.from({ length: ov.maxLen }).map((_, rowIdx) => (
                      <tr key={rowIdx} className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <td className="px-3 py-2">{rowIdx + 1}</td>
                        <td className="px-3 py-2"></td>
                        {ov.components.map(comp => {
                          const entry = ov.data[comp]?.[rowIdx];
                          return (
                            <React.Fragment key={comp}>
                              <td className="px-3 py-2 whitespace-nowrap">{entry?.date || ''}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{entry?.duration !== undefined && entry.duration !== '' ? entry.duration : ''}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{entry?.compChangeDuration !== undefined && entry.compChangeDuration !== '' ? entry.compChangeDuration : ''}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Flight Summary Tab */}
          {activeTab === 'flight' && (
            <div className={`border rounded-lg overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className={`sticky top-0 uppercase ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-700'}`}>
                    <tr>
                      <th className="px-3 py-2 text-left">S. No</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Total Duration</th>
                      <th className="px-3 py-2 text-right">Cumulative Duration</th>
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'text-white' : 'text-gray-900'}>
                    {flightSummary.map((row, i) => (
                      <tr key={i} className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <td className="px-3 py-2">{i+1}</td>
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2 text-right">{row.totalDuration}</td>
                        <td className="px-3 py-2 text-right">{row.cumulativeDuration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
