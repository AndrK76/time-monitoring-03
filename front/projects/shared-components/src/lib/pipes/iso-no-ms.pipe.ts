import { Pipe, PipeTransform } from '@angular/core';

/**
 * Убирает миллисекунды из ISO-строки, сохраняя TZ-offset.
 * Пример: 2026-09-24T09:40:41.585677+03:00 → 2026-09-24 09:40:41 +03:00
 * Если вход не ISO или пуст — возвращает как есть.
 */
@Pipe({
  name: 'isoNoMs',
  standalone: true,
})
export class IsoNoMsPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    // YYYY-MM-DDTHH:MM:SS(.fraction)?(Z|±HH:MM)?
    const m = value.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
    );
    if (!m) return value;

    const [, date, time, tz] = m;
    return tz
      ? `${date} ${time} ${tz}`
      : `${date} ${time}`;
  }
}