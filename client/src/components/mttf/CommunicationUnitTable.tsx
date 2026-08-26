import { GenericComponentTable } from './GenericComponentTable';

interface CommunicationUnitTableProps {
  filters: {
    uaName: string;
    ticket: string;
  };
}

export function CommunicationUnitTable({ filters }: CommunicationUnitTableProps) {
  return (
    <GenericComponentTable
      category="communication"
      categoryLabel="Communication Unit"
      filters={filters}
    />
  );
}

