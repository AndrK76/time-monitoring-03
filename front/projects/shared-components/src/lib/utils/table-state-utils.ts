import { TableDataChanges } from '../models/table-data-changes';
import { hasChanges, applyChanges } from './object-utils';

/**
 * Обновляет элемент в массиве данных.
 * Возвращает новый массив с обновлённым элементом, если были изменения.
 * 
 * @param dataSource - исходный массив данных
 * @param updatedItem - элемент с обновлёнными данными
 * @param idGetter - функция для получения идентификатора элемента
 * @param updateDerived - функция для пересчёта производных полей (опционально)
 * @param ignoreKeys - поля, которые нужно игнорировать при сравнении
 * @returns объект с новым массивом и флагом, были ли изменения
 */
export function updateDataSourceItem<T extends Record<string, any>>(
    dataSource: T[],
    updatedItem: T,
    idGetter: (item: T) => string | number,
    ignoreKeys?: string[]
): { data: T[]; updated: boolean } {
    const index = dataSource.findIndex(e => idGetter(e) === idGetter(updatedItem));
    if (index === -1) {
        return { data: dataSource, updated: false };
    }

    const oldRow = dataSource[index];

    // Проверяем, есть ли изменения (игнорируем служебные поля)
    if (!hasChanges(oldRow, updatedItem, ignoreKeys)) {
        return { data: dataSource, updated: false };
    }

    // Создаём копию строки и применяем изменения
    const newRow = { ...oldRow };
    applyChanges(newRow, updatedItem, ignoreKeys);


    // Создаём новый массив с обновлённой строкой
    const newData = [...dataSource];
    newData[index] = newRow;

    return { data: newData, updated: true };
}

/**
 * Создаёт пустой объект TableDataChanges.
 */
export function newTableDataChanges(): TableDataChanges {
    return { added: [], modified: [], deleted: [] };
}

/**
 * Проверяет, есть ли какие-либо изменения в TableDataChanges.
 */
export function hasTableChanges(changes: TableDataChanges): boolean {
    return changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0;
}

/**
 * Форматирует TableDataChanges в удобочитаемую строку.
 */
export function formatTableChanges(changes: TableDataChanges): string {
    const parts: string[] = [];
    if (changes.added.length > 0) {
        parts.push(`Добавлено: ${changes.added.length}`);
    }
    if (changes.modified.length > 0) {
        parts.push(`Изменено: ${changes.modified.length}`);
    }
    if (changes.deleted.length > 0) {
        parts.push(`Удалено: ${changes.deleted.length}`);
    }
    return parts.length ? parts.join(', ') : 'Изменений нет';
}

/**
 * Добавляет ID в массив добавленных элементов, если его там ещё нет.
 */
export function addNewChangeToState(changes: TableDataChanges, id: string): void {
    if (!changes.added.includes(id)) {
        changes.added.push(id);
    }
}

/**
 * Добавляет ID в массив изменённых элементов, если его там ещё нет.
 */
export function addModifyChangeToState(changes: TableDataChanges, id: string): void {
    if (!changes.modified.includes(id)) {
        changes.modified.push(id);
    }
}

/**
 * Добавляет ID в массив удалённых элементов, если его там ещё нет.
 */
export function addDeleteChangeToState(changes: TableDataChanges, id: string): void {
    if (!changes.deleted.includes(id)) {
        changes.deleted.push(id);
    }
}