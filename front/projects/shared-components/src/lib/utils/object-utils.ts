// shared-components/src/lib/utils/object-utils.ts

/**
 * Проверяет, есть ли различия между двумя объектами.
 * Игнорирует поля, начинающиеся с '_' (служебные).
 * Рекурсивно обходит вложенные объекты.
 */
export function hasChanges<T extends Record<string, any>>(
    original: T,
    modified: T,
    ignoreKeys: string[] = []
): boolean {
    const keys = new Set([...Object.keys(original), ...Object.keys(modified)]) as Set<keyof T>;
    const ignoreSet = new Set([...ignoreKeys, ...Object.keys(original).filter(k => k.startsWith('_'))]);

    for (const key of keys) {
        if (ignoreSet.has(key as string)) continue;

        const a = original[key];
        const b = modified[key];

        // Обработка массивов
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return true;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) {
                    if (typeof a[i] === 'object' && a[i] !== null && typeof b[i] === 'object' && b[i] !== null) {
                        if (hasChanges(a[i], b[i], ignoreKeys)) return true;
                    } else {
                        return true;
                    }
                }
            }
            continue;
        }

        // Сравнение объектов (рекурсия)
        if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
            if (hasChanges(a, b, ignoreKeys)) return true;
            continue;
        }

        // Сравнение примитивов
        if (a !== b) return true;
    }
    return false;
}

/**
 * Создаёт глубокую копию объекта, исключая поля, начинающиеся с '_' (служебные).
 * Использует JSON-сериализацию для простоты.
 */
export function clone<T extends Record<string, any>>(
    source: T,
    ignoreKeys: string[] = []
): T {
    // Исключаем служебные поля перед клонированием
    const cleanSource: any = {};
    const ignoreSet = new Set([...ignoreKeys, ...Object.keys(source).filter(k => k.startsWith('_'))]);
    for (const key in source) {
        if (!ignoreSet.has(key)) {
            cleanSource[key] = source[key];
        }
    }
    return JSON.parse(JSON.stringify(cleanSource));
}

/**
 * Применяет изменения из source в target (только те поля, которые отличаются).
 * Игнорирует поля, начинающиеся с '_' (служебные).
 * Мутирует target.
 */
export function applyChanges<T extends Record<string, any>>(
    target: T,
    source: T,
    ignoreKeys: string[] = []
): void {
    console.log('applyChanges before')
    console.dir(target)
    const ignoreSet = new Set([...ignoreKeys, ...Object.keys(source).filter(k => k.startsWith('_'))]);
    const keys = Object.keys(source) as (keyof T)[];
    for (const key of keys) {
        if (ignoreSet.has(key as string)) continue;
        if (source[key] !== target[key]) {
            target[key] = source[key];
        }
    }
    console.log('applyChanges after')
    console.dir(target)

}