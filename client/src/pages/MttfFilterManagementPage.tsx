import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from '../config/api';
import {
  Plus,
  Trash2,
  RefreshCw,
  Search,
  X,
  ExternalLink,
  User,
  Bookmark,
} from "lucide-react";
import { useToast } from "../components/Toast";
import { useTheme } from "../contexts/ThemeContext";

interface FilterOption {
  id: string;
  value: string;
  ticketLink?: string;
}

interface FilterOptions {
  uaNames: FilterOption[];
  tickets: FilterOption[];
}

type FilterType = "uaNames" | "tickets";

export function MttfFilterManagementPage(): JSX.Element {
  const { showToast } = useToast();
  const { theme } = useTheme();

  const [options, setOptions] = useState<FilterOptions>({
    uaNames: [],
    tickets: [],
  });

  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<FilterType | null>(
    null
  );

  const [searchTerms, setSearchTerms] = useState({
    uaNames: "",
    tickets: "",
  });

  const [newValues, setNewValues] = useState({
    value: "",
    ticketLink: "",
  });

  // default: all selected
  const [selectedFilters, setSelectedFilters] = useState<Set<FilterType>>(
    () =>
      new Set<FilterType>([
        "uaNames",
        "tickets",
      ])
  );

  // --- API helpers ----------------------------------------------------------
  const apiBase = API_BASE_URL;

  const fetchFilters = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${apiBase}/filters`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        showToast("Failed to load filters", "error");
        return;
      }
      const data = await res.json();
      setOptions({
        uaNames: data.uaNames ?? [],
        tickets: data.tickets ?? [],
      });
    } catch (err) {
      console.error("fetchFilters error", err);
      showToast("Error loading filters", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- utils ----------------------------------------------------------------
  const typeLabel = (t: FilterType) =>
    ({
      uaNames: "UA Name",
      tickets: "Ticket",
    }[t]);

  const typeToApi = (t: FilterType) =>
    ({
      uaNames: "uaName",
      tickets: "ticket",
    }[t]);

  const getFilteredItems = (items: FilterOption[], term: string) => {
    if (!term) return items;
    const q = term.trim().toLowerCase();
    return items.filter((it) => it.value.toLowerCase().includes(q));
  };

  // metadata for toggle buttons
  const FILTER_META: {
    type: FilterType;
    label: string;
    Icon: React.ComponentType<any>;
    hint?: string;
  }[] = [
    { type: "uaNames", label: "UA Names", Icon: User, hint: "Manage UA names" },
    { type: "tickets", label: "Tickets", Icon: Bookmark, hint: "Manage tickets" },
  ];

  const counts = useMemo(
    () => ({
      uaNames: options.uaNames.length,
      tickets: options.tickets.length,
    }),
    [options]
  );

  // --- user actions --------------------------------------------------------
  const toggleFilterSelected = (t: FilterType) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const selectAllFilters = () =>
    setSelectedFilters(
      new Set<FilterType>([
        "uaNames",
        "tickets",
      ])
    );

  const clearAllFilters = () => setSelectedFilters(new Set());

  const openAddModal = (filterType: FilterType) => {
    setActiveFilterType(filterType);
    setNewValues({ value: "", ticketLink: "" });
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setActiveFilterType(null);
    setNewValues({ value: "", ticketLink: "" });
  };

  const handleAdd = async () => {
    if (!activeFilterType) return;
    const value = newValues.value.trim();
    if (!value) {
      showToast("Please enter a value", "error");
      return;
    }
    if (activeFilterType === "tickets" && !newValues.ticketLink.trim()) {
      showToast("Please enter a ticket link for tickets", "error");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const body: any = {
        type: typeToApi(activeFilterType),
        value,
      };
      if (activeFilterType === "tickets") body.ticketLink = newValues.ticketLink;
      const res = await fetch(`${apiBase}/filters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.message || "Failed to add value", "error");
        return;
      }
      showToast("Value added successfully", "success");
      await fetchFilters();
      closeAddModal();
    } catch (err) {
      console.error("handleAdd error", err);
      showToast("Error adding value", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    const ok = window.confirm("Are you sure you want to remove this item?");
    if (!ok) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${apiBase}/filters/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        showToast("Failed to remove value", "error");
        return;
      }
      showToast("Value removed successfully", "success");
      await fetchFilters();
    } catch (err) {
      console.error("handleRemove error", err);
      showToast("Error removing value", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- UI subcomponents ----------------------------------------------------
  const Header = () => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 className={`text-xl sm:text-2xl font-bold ${
          theme === 'light' 
            ? 'text-gray-900' 
            : 'text-white'
        }`}>
          MTTF Filter Management
        </h1>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={fetchFilters}
          disabled={loading}
          aria-label="Refresh filters"
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition disabled:opacity-50 ${
            theme === 'light'
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );

  const TopToggleBar = () => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_META.map((m) => {
          const active = selectedFilters.has(m.type);
          return (
            <button
              key={m.type}
              onClick={() => toggleFilterSelected(m.type)}
              title={m.hint}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                active
                  ? theme === 'light'
                    ? "bg-gray-200 ring-1 ring-gray-400 text-gray-900"
                    : "bg-gray-600 ring-1 ring-gray-500 text-white"
                  : theme === 'light'
                    ? "bg-gray-50 ring-1 ring-gray-300 text-gray-600 hover:bg-gray-100"
                    : "bg-white/5 ring-1 ring-gray-700 text-gray-300 hover:bg-white/10"
              }`}
            >
              <m.Icon
                className={`w-4 h-4 ${
                  theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                }`}
              />
              <span className="font-medium">{m.label}</span>
              <span className={`ml-2 text-xs ${
                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              }`}>({(counts as any)[m.type]})</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={selectAllFilters}
          className={`px-3 py-1.5 rounded-lg text-sm transition ${
            theme === 'light'
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 hover:bg-white/6'
          }`}
        >
          Select All
        </button>
        <button
          onClick={clearAllFilters}
          className={`px-3 py-1.5 rounded-lg text-sm transition ${
            theme === 'light'
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 hover:bg-white/6'
          }`}
        >
          Clear
        </button>
      </div>
    </div>
  );

  const SectionCard: React.FC<{
    title: string;
    type: FilterType;
    items: FilterOption[];
    searchValue: string;
    onSearchChange: (v: string) => void;
    onAdd: () => void;
    onRemove: (id: string) => void;
    placeholderEmpty?: string;
    Icon?: React.ComponentType<any>;
    className?: string;
  }> = ({
    title,
    type,
    items,
    searchValue,
    onSearchChange,
    onAdd,
    onRemove,
    placeholderEmpty,
    Icon,
    className = "",
  }) => {
    const filtered = getFilteredItems(items, searchValue);
    return (
      <div className={`${
        theme === 'light'
          ? 'bg-white border border-gray-200 shadow-sm'
          : 'bg-gray-800 border border-gray-700'
      } rounded-lg p-3 flex flex-col gap-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                theme === 'light' ? 'bg-gray-100' : 'bg-gray-700'
              }`}
            >
              {Icon ? <Icon className={`w-4 h-4 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`} /> : null}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-sm font-semibold ${
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                }`}>
                  {title}
                </h3>
                <span className={`text-xs ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                }`}>({items.length})</span>
              </div>
              <p className={`text-xs mt-0.5 hidden sm:block ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-500'
              }`}>
                Manage {title.toLowerCase()} that appear in dropdowns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                theme === 'light'
                  ? 'bg-gray-900 hover:bg-gray-800 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
              title={`Add ${title}`}
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        <div>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              theme === 'light' ? 'text-gray-400' : 'text-gray-400'
            }`} />
            <input
              type="text"
              aria-label={`Search ${title}`}
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`w-full pl-10 pr-3 py-2 rounded-lg text-sm focus:outline-none transition ${
                theme === 'light'
                  ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
                  : 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
              }`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto max-h-56">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className={`h-9 rounded-lg ${
                theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
              }`} />
              <div className={`h-9 rounded-lg ${
                theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
              }`} />
              <div className={`h-9 rounded-lg ${
                theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
              }`} />
            </div>
          ) : filtered.length ? (
            <ul className="space-y-1.5">
              {filtered.map((it) => (
                <li
                  key={it.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg ${
                    theme === 'light'
                      ? 'bg-gray-50 hover:bg-gray-100'
                      : 'bg-gray-700 hover:bg-gray-650'
                  } transition`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <span className={`text-sm ${
                        theme === 'light' ? 'text-gray-900' : 'text-gray-200'
                      }`}>{it.value}</span>
                      {type === "tickets" && it.ticketLink && (
                        <a
                          href={it.ticketLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className={`text-xs hover:underline mt-0.5 flex items-center gap-1 ${
                            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" /> View link
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => onRemove(it.id)}
                      disabled={loading}
                      aria-label={`Remove ${it.value}`}
                      className={`p-1.5 rounded-md transition text-red-500 ${
                        theme === 'light'
                          ? 'hover:bg-red-50'
                          : 'hover:bg-gray-600'
                      }`}
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className={`text-center py-6 ${
              theme === 'light' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <p className="text-sm">
                {searchValue ? "No matching results" : placeholderEmpty ?? `No ${title.toLowerCase()} added yet`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // helper to render a SectionCard for a given type
  const renderSectionForType = (type: FilterType, extraClassName = "") => {
    switch (type) {
      case "uaNames":
        return (
          <SectionCard
            key={type}
            title="UA Names"
            type="uaNames"
            items={options.uaNames}
            searchValue={searchTerms.uaNames}
            onSearchChange={(v) => setSearchTerms((s) => ({ ...s, uaNames: v }))}
            onAdd={() => openAddModal("uaNames")}
            onRemove={handleRemove}
            placeholderEmpty="No UA names added yet"
            Icon={User}
            className={extraClassName}
          />
        );
      case "tickets":
        return (
          <SectionCard
            key={type}
            title="Tickets"
            type="tickets"
            items={options.tickets}
            searchValue={searchTerms.tickets}
            onSearchChange={(v) => setSearchTerms((s) => ({ ...s, tickets: v }))}
            onAdd={() => openAddModal("tickets")}
            onRemove={handleRemove}
            placeholderEmpty="No tickets added yet"
            Icon={Bookmark}
            className={extraClassName}
          />
        );
    }
  };

  const selectedArray = Array.from(selectedFilters) as FilterType[];
  const selectedCount = selectedArray.length;

  // --- Render --------------------------------------------------------------
  return (
    <div className="space-y-4">
      <Header />

      {/* Top toggle buttons to show/hide sections (multi-select allowed) */}
      <TopToggleBar />

      {/* When only one section is selected we center it. Otherwise use a responsive grid */}
      {selectedCount === 1 ? (
        <div className="flex justify-center">
          {/* give the card a max width so it doesn't stretch too wide on large screens */}
          {renderSectionForType(selectedArray[0], "w-full max-w-xl")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {selectedArray.map((t) => renderSectionForType(t))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && activeFilterType && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeAddModal}
            aria-hidden
          />

          <div className={`relative rounded-xl p-4 max-w-md w-full z-10 ${
            theme === 'light'
              ? 'bg-white border border-gray-200 shadow-lg'
              : 'bg-gray-800 border border-gray-700'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-lg font-semibold ${
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                }`}>
                  Add {typeLabel(activeFilterType)}
                </h2>
                <p className={`text-xs mt-1 ${
                  theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  Add a new {typeLabel(activeFilterType).toLowerCase()} to the
                  system
                </p>
              </div>
              <button
                onClick={closeAddModal}
                aria-label="Close"
                className={`p-1.5 rounded-md transition ${
                  theme === 'light'
                    ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className={`text-xs block mb-1 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {typeLabel(activeFilterType)}
                </label>
                <input
                  type="text"
                  value={newValues.value}
                  onChange={(e) =>
                    setNewValues((v) => ({ ...v, value: e.target.value }))
                  }
                  placeholder={`Enter ${typeLabel(activeFilterType).toLowerCase()}`}
                  className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition ${
                    theme === 'light'
                      ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
                      : 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
                  }`}
                  autoFocus
                />
              </div>

              {activeFilterType === "tickets" && (
                <div>
                  <label className={`text-xs block mb-1 ${
                    theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    Ticket Link
                  </label>
                  <input
                    type="url"
                    value={newValues.ticketLink}
                    onChange={(e) =>
                      setNewValues((v) => ({ ...v, ticketLink: e.target.value }))
                    }
                    placeholder="https://jira.example.com/browse/MTSP-57"
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition ${
                      theme === 'light'
                        ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
                        : 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
                    }`}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className={`px-4 py-2 rounded-lg text-sm transition ${
                    theme === 'light'
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAdd}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50 ${
                    theme === 'light'
                      ? 'bg-gray-900 hover:bg-gray-800 text-white'
                      : 'bg-gray-600 hover:bg-gray-500 text-white'
                  }`}
                >
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MttfFilterManagementPage;

