export interface EventRow {
  id: string;
  placeId: string;
  placeName: string;
  statusCode: string;
  statusName: string;
  statusColor?: string;
  start: string;
  end: string;
  booking_id?: string;
  details: string;
}

export function createEmptyEventRow(placeId?: string): EventRow {
  const now = new Date();
  const start = new Date(now);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(9, 0, 0, 0);

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : 'temp-' + Date.now(),
    placeId: placeId || '001-001',
    placeName: '',
    statusCode: 'empty',
    statusName: '',
    statusColor: undefined,
    start: start.toISOString(),
    end: end.toISOString(),
    booking_id: undefined,
    details: ''
  };
}

