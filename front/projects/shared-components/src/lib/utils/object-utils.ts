
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
    const ignoreSet = new Set([...ignoreKeys, ...Object.keys(source).filter(k => k.startsWith('_'))]);
    const keys = Object.keys(source) as (keyof T)[];
    for (const key of keys) {
        if (ignoreSet.has(key as string)) continue;
        if (source[key] !== target[key]) {
            target[key] = source[key];
        }
    }
}


/**
 * Добавляет к объекту служебное поле `_orig`, содержащее глубокую копию исходных данных.
 * Поля, начинающиеся с '_' и переданные в ignoreKeys, исключаются из копии.
 * @param source - исходный объект
 * @param ignoreKeys - дополнительные ключи для игнорирования
 * @returns новый объект с добавленным полем `_orig`
 */
export function addOrigData<T extends Record<string, any>>(
    source: T,
    ignoreKeys: string[] = []
): T {
    const allIgnore = new Set([
        ...ignoreKeys,
        ...Object.keys(source).filter(k => k.startsWith('_'))
    ]);

    const cleanSource: any = {};
    for (const key in source) {
        if (!allIgnore.has(key)) {
            cleanSource[key] = source[key];
        }
    }

    const cloned = JSON.parse(JSON.stringify(cleanSource));

    // Возвращаем новый объект с добавленным _orig
    return {
        ...source,
        _orig: cloned
    };
}

/**
 * Удаляет из объекта служебное поле `_orig`.
 * @param source - объект, у которого нужно удалить `_orig`
 * @returns новый объект без поля `_orig`
 */
export function removeOrigData<T extends Record<string, any>>(
    source: T
): T {
    if (source && typeof source === 'object' && '_orig' in source) {
        const { _orig, ...rest } = source;
        return rest as T;
    }
    return source;
}


/**
 * Добавляет к объекту служебное поле `_new`, показывающее что объект новый
 * @param source - исходный объект
 * @returns новый объект с добавленным полем `_new`
 */
export function addNewItemFlag<T extends Record<string, any>>(
    source: T
): T {
    return {
        ...source,
        _new: true
    };
}

/**
 * Проверяет является ли переданный элемент новым (через аттрибут `_new`)
 * @param source - исходный объект
 * @returns является ли объект новым
 */
export function isNewItem<T extends Record<string, any>>(source: T): boolean {
    return ('_new' in source && source['_new'] === true);
}


/**
 * Устанавливает/снимает признак развернуто в объекте  (через аттрибут `_expanded`)
 * @param source - исходный объект
 * @param expanded - устанавливеемый флаг (если не указан, то true)
 * @returns новый объект с добавленным полем `_expanded`
 */
export function setExpanded<T extends Record<string, any>>(
    source: T, expanded?: boolean
): T {
    const _expanded = expanded ? true : false;
    return {
        ...source,
        _expanded: _expanded
    };
}

/**
 * Проверяет является ли переданный элемент развернутым (через аттрибут `_expanded`)
 * @param source - исходный объект
 * @returns является ли объект развернутым
 */
export function isExpanded<T extends Record<string, any>>(source: T): boolean {
    return ('_expanded' in source && source['_expanded'] === true);
}

/**
 * Добавляет к объекту служебное поле `_dettached`, показывающее что объект не подтверждён
 * @param source - исходный объект
 * @returns новый объект с добавленным полем `_dettached`
 */
export function addNotApplyItemFlag<T extends Record<string, any>>(
    source: T
): T {
    return {
        ...source,
        _dettached: true
    };
}

/**
 * Проверяет является ли переданный элемент новым (через аттрибут `_new`)
 * @param source - исходный объект
 * @returns является ли объект новым
 */
export function isNotApplyItem<T extends Record<string, any>>(source: T): boolean {
    return ('_dettached' in source && source['_dettached'] === true);
}

/**
 * Удаляет из объекта служебное поле `_dettached`, показывающее что объект не подтверждён
 * @param source - исходный объект
 * @returns новый объект с удаленным полем `_dettached`
 */
export function removeNotApplyItemFlag<T extends Record<string, any>>(
    source: T
): T {
    if ('_dettached' in source) {
        const { _dettached, ...res } = source;
        return res as T;
    }
    return source;
}

/**
 * Добавляет к объекту служебное поле `_needload`, показывающее что объект нужно прочитать полностью
 * @param source - исходный объект
 * @returns новый объект с добавленным полем `_needload`
 */
export function addNotFullLoadItemFlag<T extends Record<string, any>>(
    source: T
): T {
    return {
        ...source,
        _needload: true
    };
}

/**
 * Проверяет является ли переданный элемент не полностью прочитанным (через аттрибут `_needload`)
 * @param source - исходный объект
 * @returns является ли объект новым
 */
export function isNotFullLoadedItem<T extends Record<string, any>>(source: T): boolean {
    return ('_needload' in source && source['_needload'] === true) || !('_needload' in source);
}

/**
 * Устанавливает в объекте служебное поле `_needload` в false, показывающее что объект не нуждается в перечитывании
 * @param source - исходный объект
 * @returns новый объект с добавленным полем `_needload`
 */
export function removeNotFullLoadItemFlag<T extends Record<string, any>>(
    source: T
): T {
    /*if ('_needload' in source) {
        const { _needload, ...res } = source;
        return res as T;
    }
    return source;*/
    return {
        ...source,
        _needload: false
    };
}

/**
 * Получает массив из ключей объекта.
 * @param arr - массив или null/undefined
 * @param idGetter - функция получения идентификатора из элемента (например, (item) => item.id)
 * @returns массив ключей объектов
 */
export function getIdsArray<T,V>(arr: T[] | undefined | null, idGetter: (item: T) => V): (V)[] {
    return Array.from(new Set((arr || []).map(item => idGetter(item))));
}

/**
 * Сравнивает два массива объектов по идентификаторам, игнорируя порядок и дубликаты.
 * @param arr1 - первый массив или null/undefined
 * @param arr2 - второй массив или null/undefined
 * @param idGetter - функция получения идентификатора из элемента (например, (item) => item.id)
 * @returns true, если оба массива содержат одинаковые множества идентификаторов,
 *          или оба являются пустыми / null / undefined.
 */
export function isArrayEqualByKeys<T>(
    arr1: T[] | undefined | null,
    arr2: T[] | undefined | null,
    idGetter: (item: T) => string | number
): boolean {
    // Приводим null/undefined к пустым массивам
    const a1 = arr1 ?? [];
    const a2 = arr2 ?? [];

    // Если оба пусты – они равны
    if (a1.length === 0 && a2.length === 0) {
        return true;
    }

    // Если один пуст, а другой нет – не равны
    if (a1.length === 0 || a2.length === 0) {
        return false;
    }

    // Строим множества уникальных идентификаторов
    const keys1 = new Set(a1.map(item => idGetter(item)));
    const keys2 = new Set(a2.map(item => idGetter(item)));

    // Сравниваем размеры множеств
    if (keys1.size !== keys2.size) {
        return false;
    }

    // Проверяем, что все ключи из первого присутствуют во втором
    for (const key of keys1) {
        if (!keys2.has(key)) {
            return false;
        }
    }

    return true;
}


