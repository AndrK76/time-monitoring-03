import { HttpErrorResponse } from "@angular/common/http";
import { MacroscopDataResponse } from "./macroscop-dto-items";
import { from, map, Observable } from "rxjs";

const extractMessage = (text: string, status: number): string => {
    try {
        const parsed = JSON.parse(text);
        return parsed?.detail
            ?? parsed?.message
            ?? parsed?.errorMessage
            ?? `Ошибка ${status}`;
    } catch {
        return text.trim() || `Ошибка ${status}`;
    }
}

async function parseErrorBody(err: HttpErrorResponse): Promise<string> {
    if (err.error instanceof Blob) {
        try {
            const text = await err.error.text();
            return extractMessage(text, err.status);
        } catch {
            return `Ошибка ${err.status}`;
        }
    }
    if (typeof err.error === 'string' && err.error.length > 0) {
        return extractMessage(err.error, err.status);
    }
    if (err.error && typeof err.error === 'object') {
        const e = err.error as any;
        return e.detail ?? e.message ?? e.errorMessage ?? `Ошибка ${err.status}`;
    }
    return err.message ?? `Ошибка ${err.status}`;
}

export const toFailMacroscopDataResponse = (err: HttpErrorResponse): Observable<MacroscopDataResponse<Blob>> => {
    return from(parseErrorBody(err)).pipe(
        map(message => ({
            statusCode: err.status,
            success: false,
            errorMessage: message,
            data: undefined,
        } as MacroscopDataResponse<Blob>)),
    );
}