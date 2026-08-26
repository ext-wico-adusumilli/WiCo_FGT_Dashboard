import { GenericComponentTable } from './GenericComponentTable';

interface ControllerSensorTableProps {
  filters: {
    uaName: string;
    ticket: string;
  };
}

export function ControllerSensorTable({ filters }: ControllerSensorTableProps) {
  return (
    <GenericComponentTable
      category="controller"
      categoryLabel="Controller and Sensor"
      filters={filters}
    />
  );
}

