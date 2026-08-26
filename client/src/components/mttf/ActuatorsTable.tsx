import { GenericComponentTable } from './GenericComponentTable';

interface ActuatorsTableProps {
  filters: {
    uaName: string;
    ticket: string;
  };
}

export function ActuatorsTable({ filters }: ActuatorsTableProps) {
  return (
    <GenericComponentTable
      category="actuators"
      categoryLabel="Actuators (Tilt and Control Surface)"
      filters={filters}
    />
  );
}

