import { catchError, concatMap, from, map, Observable, of } from 'rxjs';
import { SaveDataError, TableDataChanges } from '../models/table-data-items';
import { hasChanges, applyChanges, addOrigData, setExpanded, addNewItemFlag } from './object-utils';
import { TableFilterDateValue, TableFilterInfo, TableFilterListValue, TableFilterTextValue, TableFilterType } from '../models/table-filter-items';
import { MatTableDataSource } from '@angular/material/table';


/**
 * Обновляет элемент в массиве данных.
 * Возвращает новый массив с обновлённым элементом, если были изменения.
 * 
 * @param dataSource - исходный массив данных
 * @param updatedItem - элемент с обновлёнными данными
 * @param idGetter - функция для получения идентификатора элемента
 * @param ignoreKeys - поля, которые нужно игнорировать при сравнении
 * @returns объект с новым массивом и флагом, были ли изменения
 */
export function selectDataSourceItem<T extends Record<string, any>>(
    dataSource: T[],
    selectedItem: T,
    idGetter: (item: T) => string | number,
    expanded: boolean,
    collapseOthers?: boolean,
    ignoreKeys?: string[]
): { data: T[]; selected: boolean; expanded: boolean } {
    const index = dataSource.findIndex(e => idGetter(e) === idGetter(selectedItem));
    if (index === -1) {
        return { data: dataSource, selected: false, expanded: false };
    }

    let newData = [...dataSource];

    if (collapseOthers && expanded) {
        newData = newData.map((item, i) => {
            if (i === index) {
                return setExpanded(addOrigData(item, ignoreKeys), true);
            } else {
                return setExpanded(item, false)
            }

        });

    } else {

        let newRow = dataSource[index];
        if (expanded)
            newRow = addOrigData(newRow, ignoreKeys);
        newRow = setExpanded(newRow, expanded);
        newData[index] = newRow;
    }

    return { data: newData, selected: true, expanded: expanded };
}


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
    return { added: [], modified: [], deleted: [], deletedItems: [] };
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
export function addDeleteChangeToState<T extends Record<string, any>>(
    changes: TableDataChanges,
    item: T,
    idGetter: (item: T) => string | number
): TableDataChanges {
    let newAdded = changes.added;
    let newModified = changes.modified;
    let newDeleted = changes.deleted;
    let newDeletedItems = changes.deletedItems;
    const id = idGetter(item) as string;
    if (newModified.includes(id)) {
        newModified = newModified.filter(item => item !== id)
    }
    if (newAdded.includes(id)) {
        newAdded = newAdded.filter(item => item !== id)
    } else if (!newDeleted.includes(id)) {
        newDeleted = [...newDeleted, id];
        newDeletedItems = [...newDeletedItems, item];
    }
    return { added: newAdded, modified: newModified, deleted: newDeleted, deletedItems: newDeletedItems };
}


/**
 * Сохраняет изменения в таблице, обрабатывая каждую запись по одной.
 * При ошибке не прерывается, добавляет ошибку в массив.
 * Возвращает Observable с результатом.
 */
export function doSaveData<T extends Record<string, any>>(
    data: T[],
    idGetter: (item: T) => string | number,
    changes: TableDataChanges,
    addFn: (item: T) => Observable<T>,
    updateFn: (item: T) => Observable<T>,
    deleteFn: (item: T) => Observable<void>,
): Observable<{ data: T[]; changes: TableDataChanges; success: boolean; errors: SaveDataError[] }> {
    return new Observable(subscriber => {
        let currentData = [...data];
        let currentChanges = {
            added: [...changes.added],
            modified: [...changes.modified],
            deleted: [...changes.deleted],
            deletedItems: [...changes.deletedItems]
        };
        const errors: SaveDataError[] = [];

        // Функция для обработки одного элемента
        const processItem = (id: string, type: 'add' | 'update' | 'delete'): Observable<void> => {
            let item: T | undefined;
            let index = -1;
            if (type === 'delete') {
                index = currentChanges.deletedItems.findIndex(item => idGetter(item) === id);
                item = currentChanges.deletedItems[index];
            } else {
                index = currentData.findIndex(item => idGetter(item) === id);
                item = currentData[index];
            }
            if (index === -1) {
                return of(undefined);
            } let observable: Observable<any>;
            if (type === 'add') {
                observable = addFn(item!);
            } else if (type === 'update') {
                observable = updateFn(item!);
            } else {
                observable = deleteFn(item!);
            }
            return observable.pipe(
                map(result => {
                    if (type === 'add') {
                        const newItem = result as T;
                        currentData[index] = newItem;
                        currentChanges.added = currentChanges.added.filter(i => i !== id);
                    } else if (type === 'update') {
                        currentChanges.modified = currentChanges.modified.filter(i => i !== id);
                    } else if (type === 'delete') {
                        //currentData.splice(index, 1);
                        // Удаляем из deleted
                        currentChanges.deleted = currentChanges.deleted.filter(i => i !== id);
                        currentChanges.deletedItems = currentChanges.deletedItems.filter(i => idGetter(i) !== id);
                    }
                }),
                catchError(err => {
                    // Добавляем ошибку
                    errors.push({ id, message: err.message || 'Unknown error' });
                    return of(undefined);
                })
            );
        };

        // Создаём массив операций
        const operations: Observable<void>[] = [];
        // Сначала добавления, потом обновления, потом удаления
        currentChanges.added.forEach(id => operations.push(processItem(id, 'add')));
        currentChanges.modified.forEach(id => operations.push(processItem(id, 'update')));
        currentChanges.deleted.forEach(id => operations.push(processItem(id, 'delete')));

        // Выполняем последовательно
        from(operations).pipe(
            concatMap(op => op)
        ).subscribe({
            complete: () => {
                const success = errors.length === 0;
                subscriber.next({
                    data: currentData,
                    changes: currentChanges,
                    success,
                    errors
                });
                subscriber.complete();
            },
            error: (err) => {
                subscriber.error(err);
            }
        });
    });
}



/**
 * Создаёт функцию-предикат для фильтрации данных на основе конфигурации фильтров.
 * @param getFilterConfig - функция, возвращающая актуальную карту фильтров (сигнал или обычная функция)
 * @returns предикат для MatTableDataSource.filterPredicate
 */
export function createFilterPredicate<T extends Record<string, any>>(
    getFilterConfig: () => Map<string, TableFilterInfo>
): (data: T, filter: string) => boolean {
    return (data: T, filter: string): boolean => {
        const config = getFilterConfig();
        for (const [key, info] of config) {
            if (!info.value) continue;
            const type = info.type;
            if (type === TableFilterType.LIST) {
                const value = info.value as TableFilterListValue;
                if (value.id !== undefined && value.id !== null) {
                    if (data[key] !== value.id) return false;
                }
            } else if (type === TableFilterType.DATE) {
                const dateVal = info.value as TableFilterDateValue;
                if (dateVal.date) {
                    const parts = dateVal.date.split('.');
                    if (parts.length === 3) {
                        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        const itemDate = new Date(data[key]);
                        if (!isNaN(itemDate.getTime())) {
                            const itemDateStr = itemDate.toISOString().slice(0, 10);
                            if (dateVal.greatest) {
                                if (itemDateStr < isoDate) return false;
                            } else {
                                if (itemDateStr > isoDate) return false;
                            }
                        }
                    }
                }
            } else if (type === TableFilterType.TEXT) {
                const textVal = info.value as TableFilterTextValue;
                const text = textVal.text || '';
                const flag = textVal.flag;
                const fieldValue = (data[key] || '').toString();
                if (flag === '~0') {
                    if (fieldValue !== '') return false;
                } else if (flag === '~1') {
                    if (fieldValue === '') return false;
                } else if (flag === '~!') {
                    if (fieldValue !== '' && fieldValue.includes(text)) return false;
                } else {
                    if (text && !fieldValue.includes(text)) return false;
                }
            }
        }
        return true;
    };
}

/**
 * Инициализирует filterPredicate для dataSource и сразу применяет фильтры.
 * @param dataSource - источник данных таблицы
 * @param getFilterConfig - функция для получения актуальной карты фильтров
 */
export function initFilterPredicate<T extends Record<string, any>>(
    dataSource: MatTableDataSource<T>,
    getFilterConfig: () => Map<string, TableFilterInfo>
): void {
    dataSource.filterPredicate = createFilterPredicate(getFilterConfig);
    // Триггерим применение фильтров
    dataSource.filter = 'apply';
}

/**
 * Обновляет значение фильтра для указанного ключа и возвращает новую карту.
 * @param config - текущая карта фильтров
 * @param key - ключ фильтра
 * @param value - новое значение (сохраняется в info.value)
 * @returns новая карта с обновлённым фильтром
 */
export function updateFilterConfig(
    config: Map<string, TableFilterInfo>,
    key: string,
    value: any
): Map<string, TableFilterInfo> {
    const newMap = new Map(config);
    const existing = newMap.get(key);
    if (existing) {
        newMap.set(key, { ...existing, value });
    }
    return newMap;
}

/**
 * Сбрасывает все значения фильтров (устанавливает undefined).
 * @param config - текущая карта фильтров
 * @returns новая карта со сброшенными значениями
 */
export function clearFilterValues(config: Map<string, TableFilterInfo>): Map<string, TableFilterInfo> {
    const newMap = new Map(config);
    for (const [key, val] of newMap) {
        newMap.set(key, { ...val, value: undefined });
    }
    return newMap;
}

/**
 * Применяет текущие фильтры к dataSource (триггер пересчёта).
 * @param dataSource - источник данных таблицы
 */
export function applyFilters<T>(dataSource: MatTableDataSource<T>): void {
    dataSource.filter = 'apply';
}