import { GenericComponentTable } from './GenericComponentTable';

interface PropulsionSystemTableProps {
  filters: {
    uaName: string;
    ticket: string;
  };
}

export function PropulsionSystemTable({ filters }: PropulsionSystemTableProps) {
  return (
    <GenericComponentTable
      category="propulsion"
      categoryLabel="Propulsion System"
      filters={filters}
    />
  );
}

