import { parseISO, formatISO } from 'date-fns';
import { format, toZonedTime, fromZonedTime } from 'date-fns-tz';


// Преобразование локальной строки -> UTC (если TZ не указано, то считаем что в локальной TZ)
export function toUtcDateStringAlways(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  const hasZone = /[+-]\d{2}:\d{2}$|Z$/i.test(dateTimeStr);

  let date: Date;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (hasZone) {
    // Строка уже содержит зону (Z или +-HH:MM) – парсим как UTC
    date = parseISO(dateTimeStr);
  } else {
    // Строка без зоны – интерпретируем как локальное время в указанной зоне
    date = fromZonedTime(dateTimeStr, timeZone);
  }
  // Преобразуем в локальное время для отображения
  const localDate = toZonedTime(date, timeZone);
  return formatISO(localDate, { representation: 'complete' });
}

// Преобразует UTC-строку в формат для <input type="datetime-local">
export function toLocalInputString(utcString: string): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const date = parseISO(utcString);
  const zoned = toZonedTime(date, timeZone);
  return format(zoned, "yyyy-MM-dd'T'HH:mm", { timeZone });
}


// Преобразование локальной строки -> UTC в TZ клиента
export function fromLocalInputToUtc(localInput: string): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // Добавляем секунды и миллисекунды для корректного парсинга
  const dateStr = localInput + ':00.000';
  // Интерпретируем как локальное время в целевой зоне
  const utcDate = fromZonedTime(dateStr, timeZone);
  return utcDate.toISOString(); // всегда возвращает 'YYYY-MM-DDTHH:mm:ss.SSSZ'
}