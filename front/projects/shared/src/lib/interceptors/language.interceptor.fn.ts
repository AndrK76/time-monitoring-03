import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LOCALE_ID } from '@angular/core';

export const languageInterceptorFn: HttpInterceptorFn = (req, next) => {
    const locale = inject(LOCALE_ID);
    
    // Добавляем кастомный заголовок с языком
    const modifiedReq = req.clone({
        setHeaders: {
            'Accept-Language': locale // 'ru' или 'en'
        }
    });
    
    return next(modifiedReq);
};