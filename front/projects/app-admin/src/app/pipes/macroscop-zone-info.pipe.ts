import { Pipe, PipeTransform } from '@angular/core';
import { MacroscopZoneInfoView } from '../features/macroscop/macroscop-view.models';

@Pipe({
    name: 'macroscopZoneInfo',
    standalone: true,
})
export class MacroscopZoneInfoPipe implements PipeTransform {
    transform(zone: MacroscopZoneInfoView | undefined | null): string {
        if (!zone) return 'не определено';

        const { left, top, width, height } = zone;

        // Если хотя бы одна координата не задана — считаем зону не определённой.
        if (left == null || top == null || width == null || height == null) {
            return 'не определено';
        }

        const p = (v: number) => Math.round(v * 100);

        const x1 = p(left);
        const y1 = p(top);
        const x2 = p(left + width);
        const y2 = p(top + height);

        return `(${x1},${y1})-(${x2},${y2})`;
    }
}