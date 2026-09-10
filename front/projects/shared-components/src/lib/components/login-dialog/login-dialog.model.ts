import { LoginRequestDto } from '@mon3/sa';

/**
 * Данные, передаваемые в диалог логина.
 * Все поля текстовые — задают заголовки/подписи/ссылку.
 */
export interface LoginDialogData {
    /** Заголовок диалога (например, «Вход в систему», «Получение токена») */
    title: string;
    /** Подпись основной кнопки (например, «Войти», «Получить») */
    submitLabel: string;
    /** Подпись кнопки отмены (по умолчанию «Отмена») */
    cancelLabel?: string;
    /** Подпись дополнительной ссылки (например, «Нет аккаунта? Зарегистрироваться») */
    extraLinkLabel?: string;
    /** Маршрут дополнительной ссылки (например, «/register») */
    extraLinkRoute?: string;
}

/**
 * Результат работы диалога логина.
 * - submitted — пользователь нажал основную кнопку (передаём введённые данные)
 * - cancelled — пользователь нажал «Отмена» (закрыли диалог)
 */
export type LoginDialogResult =
    | { action: 'submitted'; data: LoginRequestDto }
    | { action: 'cancelled' };