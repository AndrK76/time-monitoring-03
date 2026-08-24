import { TableDataChanges } from '../models/table-data-changes';
import { hasChanges, applyChanges, addOrigData, setExpanded, addNewItemFlag } from './object-utils';

/**
 * Обновляет элемент в массиве данных.
 * Возвращает новый массив с обновлённым элементом, если были изменения.
 * 
 * @param dataSource - исходный массив данных
 * @param updatedItem - элемент с обновлёнными данными
 * @param idGetter - функция для получения идентификатора элемента
 * @param ignoreKeys - поля, которые нужно игнорировать при сравнении
 * @param applyChangesToOrig - обновлять поля в оригинальном объекте
 * @returns объект с новым массивом и флагом, были ли изменения
 */
export function updateDataSourceItem<T extends Record<string, any>>(
    dataSource: T[],
    updatedItem: T,
    idGetter: (item: T) => string | number,
    ignoreKeys?: string[],
    applyChangesToOrig?: boolean
): { data: T[]; updated: boolean } {
    const index = dataSource.findIndex(e => idGetter(e) === idGetter(updatedItem));
    if (index === -1) {
        return { data: dataSource, updated: false };
    }

    const oldRow = dataSource[index];
    const compareWith = (oldRow as any)._orig || oldRow;

    // Проверяем, есть ли изменения (игнорируем служебные поля)
    if (!hasChanges(compareWith, updatedItem, ignoreKeys)) {
        return { data: dataSource, updated: false };
    }

    // Создаём копию строки и применяем изменения
    let newRow = { ...oldRow };
    applyChanges(newRow, updatedItem, ignoreKeys);
    if (applyChangesToOrig && oldRow['_orig']) {
        newRow = addOrigData(newRow);
    }

    // Создаём новый массив с обновлённой строкой
    const newData = [...dataSource];
    newData[index] = newRow;

    return { data: newData, updated: true };
}


/**
 * Обновляет элемент в массиве данных.
 * Возвращает новый массив с обновлённым элементом, если были изменения.
 * 
 * @param dataSource - исходный массив данных
 * @param addItem - элемент с добавленными данными
 * @param ignoreKeys - поля, которые нужно игнорировать при сравнении
 * @returns объект с новым массивом и флагом, были ли добавления
 */
export function addDataSourceItem<T extends Record<string, any>>(
    dataSource: T[],
    addItem: T,
    ignoreKeys?: string[]
): { data: T[]; added: boolean } {

    let newRow = addOrigData(addItem, ignoreKeys);
    newRow = setExpanded(newRow, true);
    newRow = addNewItemFlag(newRow);
    // Создаём новый массив с обновлённой строкой
    const newData = [newRow, ...dataSource];
    return { data: newData, added: true };
}

/**
 * Удаляет элемент из массива данных.
 * Возвращает новый массив без удаленного элемента если элемент найден.
 * 
 * @param dataSource - исходный массив данных
 * @param deletedItem - удаляемый элемент
 * @param idGetter - функция для получения идентификатора элемента
 * @returns объект с новым массивом и флагом, было ли удаление
 */
export function deleteDataSourceItem<T extends Record<string, any>>(
    dataSource: T[],
    deletedItem: T,
    idGetter: (item: T) => string | number
): { data: T[]; deleted: boolean } {
    const index = dataSource.findIndex(e => idGetter(e) === idGetter(deletedItem));
    if (index === -1) {
        return { data: dataSource, deleted: false };
    }
    const newData = [...dataSource];
    newData.splice(index, 1);
    return { data: newData, deleted: true };
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
 * Добавляет ID в массив добавленных элементов (иммутабельно).
 */
export function addNewChangeToState(
    changes: TableDataChanges,
    id: string
): TableDataChanges {
    if (changes.added.includes(id)) {
        return changes;
    }
    return {
        ...changes,
        added: [...changes.added, id]
    };
}

/**
 * Добавляет ID в массив изменённых элементов (иммутабельно).
 */
export function addModifyChangeToState(
    changes: TableDataChanges,
    id: string
): TableDataChanges {
    if (changes.modified.includes(id)) {
        return changes;
    } else if (changes.added.includes(id)) {
        return changes;
    }
    return {
        ...changes,
        modified: [...changes.modified, id]
    };
}

/**
 * Добавляет ID в массив удалённых элементов (иммутабельно).
 */
export function addDeleteChangeToState(
    changes: TableDataChanges,
    id: string
): TableDataChanges {
    let newAdded = changes.added;
    let newModified = changes.modified;
    let newDeleted = changes.deleted;
    if (newModified.includes(id)) {
        newModified = newModified.filter(item => item !== id)
    }
    if (newAdded.includes(id)) {
        newAdded = newAdded.filter(item => item !== id)
    } else if (!newDeleted.includes(id)) {
        newDeleted = [...newDeleted, id]
    }
    return { added: newAdded, modified: newModified, deleted: newDeleted };
}