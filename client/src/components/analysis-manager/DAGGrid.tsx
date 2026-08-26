import React from 'react';
import { AlertCircle } from 'lucide-react';
import { DagStatus } from '../../types/airflow';
import { useTheme } from '../../contexts/ThemeContext';
import { DAGListView } from './DAGListView';

interface DAGGridProps {
  dags: DagStatus[];
  onTriggerDag: (dagId: string) => void;
  onPauseDag: (dagId: string) => void;
  onUnpauseDag: (dagId: string) => void;
  onDeleteDag: (dagId: string) => void;
  loading?: boolean;
  hasFilters?: boolean;
  pageOffset?: number;
}

export function DAGGrid({ dags, onTriggerDag, onPauseDag, onUnpauseDag, onDeleteDag, loading = false, hasFilters = false, pageOffset = 0 }: DAGGridProps) {
  const { theme } = useTheme();

  if (loading) {
    return <DAGListView dags={[]} onTriggerDag={onTriggerDag} onPauseDag={onPauseDag} onUnpauseDag={onUnpauseDag} onDeleteDag={onDeleteDag} loading={true} />;
  }

  if (dags.length === 0) {
    return (
      <div className={`text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">
          {hasFilters ? 'No DAGs Match Your Filters' : 'No DAGs Found'}
        </h3>
        <p>
          {hasFilters 
            ? 'Try adjusting your filters or search term to see more results.'
            : 'No Airflow DAGs are currently available or visible.'
          }
        </p>
      </div>
    );
  }

  return (
    <DAGListView
      dags={dags}
      onTriggerDag={onTriggerDag}
      onPauseDag={onPauseDag}
      onUnpauseDag={onUnpauseDag}
      onDeleteDag={onDeleteDag}
      pageOffset={pageOffset}
    />
  );
}
