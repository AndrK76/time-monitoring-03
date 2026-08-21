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
  details: string; // длинная "мусорная" колонка
}