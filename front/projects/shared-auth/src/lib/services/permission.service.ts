import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { UserResponseDto } from '../models/auth.models';
import { RequiredPermission } from '../models/permission.models';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  private auth: AuthService = inject(AuthService);

  constructor() {
    this.auth.onAuthChange((authenticated) => {
      if (authenticated) {
        this.currentUser.set(this.auth.currentUser());
      } else {
        this.currentUser.set(null);
      }
    });
  }

  private currentUser = signal<UserResponseDto | null>(null)


  checkPermissions(requestData: any): boolean {
    const user = this.currentUser() || this.auth.getStoredUser();
    //console.log(user?.username);
    //console.log(JSON.stringify(requestData));
    const normData = this.normalizePermissions(requestData);
    //console.log(JSON.stringify(normData));
    const res = this.evaluatePermissions(normData, user?.permissions || []);
    //console.log(`result: ${res}`);
    return res;
  }

  /**
   * Нормализует входные данные в массив RequiredPermission.
   * Поддерживает:
   * - строку (превращается в объект с одной группой)
   * - массив строк (объект с mode: 'or' и всеми строками)
   * - массив объектов RequiredPermission
   * - объект с числовыми ключами (массивоподобный) — рекурсивно преобразуется
   * - объект с полями mode/groups (один RequiredPermission)
   */
  private normalizePermissions(input: any): RequiredPermission[] {
    //console.log('=== normalizePermissions ===');
    //console.log('Input type:', typeof input);
    //console.log('Input value:', JSON.stringify(input));

    // 1. undefined / null
    if (input === undefined || input === null) {
      //console.log('Input is undefined or null -> return []');
      return [];
    }

    // 2. Строка
    if (typeof input === 'string') {
      //console.log('Input is string -> return [{ mode: "or", groups: [input] }]');
      return [{ mode: 'or', groups: [input] }];
    }

    // 3. Массив
    if (Array.isArray(input)) {
      //console.log('Input is array, length:', input.length);
      if (input.length === 0) {
        //console.log('Empty array -> return []');
        return [];
      }

      // Все элементы — строки?
      if (input.every(item => typeof item === 'string')) {
        //console.log('Array of strings -> return [{ mode: "or", groups: input }]');
        return [{ mode: 'or', groups: input as string[] }];
      }

      // Все элементы — объекты (предполагаем, что это RequiredPermission)
      if (input.every(item => typeof item === 'object' && item !== null)) {
        //console.log('Array of objects -> return as array of RequiredPermission');
        return input as RequiredPermission[];
      }

      // Смешанные типы — попробуем преобразовать каждый элемент в строку? Лучше вернуть пустой массив
      //console.warn('Mixed array types, returning []');
      return [];
    }

    // 4. Объект
    if (typeof input === 'object' && input !== null) {
      const keys = Object.keys(input);
      //console.log('Object keys:', keys);

      if (keys.length === 0) {
        //console.log('Empty object structure, returning []');
        return [];
      }

      // 4a. Объект с числовыми ключами (массивоподобный)
      if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
        //console.log('Object with numeric keys -> convert to array and recurse');
        const arrayFromObject = Object.values(input);
        return this.normalizePermissions(arrayFromObject);
      }

      // 4b. Объект с полями mode и groups (RequiredPermission)
      if ('mode' in input || 'groups' in input) {
        //console.log('Object with mode/groups -> return [input] as RequiredPermission');
        return [input as RequiredPermission];
      }

      // 4c. Иначе — неизвестная структура
      //console.warn('Unknown object structure, returning []');
      return [];
    }

    // 5. Прочие типы (число, boolean и т.д.) — не поддерживаются
    //console.warn('Unsupported type, returning []');
    return [];
  }

  private evaluatePermissions(condition: any, userPermissions: string[]): boolean {
    //console.log('--- evaluatePermissions ---');
    //console.log('Condition type:', typeof condition);
    //console.log('Condition value:', typeof condition !== 'string' ? JSON.stringify(condition) : condition);
    //console.log('User permissions:', JSON.stringify(userPermissions));

    const userPermsUpper = userPermissions.map(p => p.toUpperCase());
    //console.log('User permissions (upper):', JSON.stringify(userPermsUpper));

    // 0. Пусто 
    if (!condition) {
      const result = false;
      //console.log(`Empty condition "${condition}" -> ${reqUpper}, result: ${result}`);
      return result;
    }


    // 1. Строка
    if (typeof condition === 'string') {
      const reqUpper = condition.toUpperCase();
      const result = userPermsUpper.some(p => p === reqUpper);
      //console.log(`String condition "${condition}" -> ${reqUpper}, result: ${result}`);
      return result;
    }

    // 2. Массив
    if (Array.isArray(condition)) {
      //console.log('Condition is array, length:', condition.length);
      if (condition.length === 0) {
        //console.log('Empty array -> return true');
        return true;
      }

      // Если первый элемент — строка, считаем массивом строк (OR)
      if (typeof condition[0] === 'string') {
        const required = condition as string[];
        //console.log('Array of strings:', required);
        const result = required.some(req => {
          const match = userPermsUpper.includes(req.toUpperCase());
          //console.log(`  Checking "${req}" -> match: ${match}`);
          return match;
        });
        //console.log('Result for array of strings (OR):', result);
        return result;
      }

      // Иначе — массив RequiredPermission (OR по умолчанию)
      //console.log('Array of RequiredPermission objects');
      const result = condition.some((item: RequiredPermission) => {
        //console.log('  Processing item:', JSON.stringify(item));
        const res = this.evaluatePermissionObject(item, userPermsUpper);
        //console.log(`  Item result: ${res}`);
        return res;
      });
      //console.log('Result for array of objects (some):', result);
      return result;
    }

    // 3. Объект (RequiredPermission)
    if (typeof condition === 'object' && condition !== null) {
      //console.log('Condition is object (RequiredPermission)');
      const result = this.evaluatePermissionObject(condition, userPermsUpper);
      //console.log('Result for object:', result);
      return result;
    }

    //console.log('Condition type not recognized -> return false');
    return false;
  }

  private evaluatePermissionObject(obj: RequiredPermission, userPermsUpper: string[]): boolean {
    //console.log('  === evaluatePermissionObject ===');
    //console.log('  Object:', JSON.stringify(obj));
    //console.log('  userPermsUpper:', JSON.stringify(userPermsUpper));

    const { mode = 'or', groups } = obj;
    //console.log(`  mode: "${mode}", groups:`, groups);

    if (!groups) {
      //console.log('  groups is falsy -> return true');
      return true;
    }

    // 1. groups — строка
    if (typeof groups === 'string') {
      const reqUpper = groups.toUpperCase();
      const result = userPermsUpper.some(p => p === reqUpper);
      //console.log(`  groups is string "${groups}" -> ${reqUpper}, result: ${result}`);
      return result;
    }

    // 2. groups — массив (может содержать строки и/или объекты)
    if (Array.isArray(groups)) {
      //console.log('  groups is array, length:', groups.length);
      if (groups.length === 0) {
        //console.log('  groups is empty array -> return true');
        return true;
      }

      // Проходим по каждому элементу и вычисляем результат
      const results: boolean[] = [];
      for (const item of groups) {
        if (typeof item === 'string') {
          const match = userPermsUpper.includes(item.toUpperCase());
          //console.log(`    Checking string "${item}" -> match: ${match}`);
          results.push(match);
        } else if (typeof item === 'object' && item !== null) {
          // Рекурсивно обрабатываем вложенный RequiredPermission
          //console.log('    Recursing into nested object:', JSON.stringify(item));
          const res = this.evaluatePermissionObject(item as RequiredPermission, userPermsUpper);
          //console.log(`    Nested result: ${res}`);
          results.push(res);
        } else {
          //console.warn('    Unknown item type in groups array, treating as false');
          results.push(false);
        }
      }

      //console.log('  Results array:', results);
      const finalResult = mode === 'and' ? results.every(r => r) : results.some(r => r);
      //console.log(`  mode ${mode} -> final result: ${finalResult}`);
      return finalResult;
    }

    // 3. groups — объект (но не массив) — вложенное условие
    if (typeof groups === 'object' && groups !== null) {
      //console.log('  groups is object (nested) -> recurse');
      const result = this.evaluatePermissionObject(groups as RequiredPermission, userPermsUpper);
      //console.log(`  Nested object result: ${result}`);
      return result;
    }

    //console.log('  groups type not recognized -> return false');
    return false;
  }


}
