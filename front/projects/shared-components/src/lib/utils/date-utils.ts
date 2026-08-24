import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Преобразование UTC -> локальная строка для datetime-local
export function toLocalDatetimeString(utcDateStr: string): string {
    if (!utcDateStr) return '';
    const date = parseISO(utcDateStr);
    const zoned = toZonedTime(date, Intl.DateTimeFormat().resolvedOptions().timeZone);
    return format(zoned, "yyyy-MM-dd'T'HH:mm");
}

// Преобразование локальной строки -> UTC
export function toUtcDateString(localDatetimeStr: string): string {
    if (!localDatetimeStr) return '';
    const [datePart, timePart] = localDatetimeStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    // Создаём локальную дату
    const localDate = new Date(year, month - 1, day, hours, minutes);
    // Возвращаем UTC ISO (с Z)
    return localDate.toISOString();
}