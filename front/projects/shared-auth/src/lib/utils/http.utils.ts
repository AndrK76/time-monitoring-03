import { WritableSignal } from "@angular/core";
import { catchError, Observable, of } from "rxjs";

export function handleError<T>(message: string, ret: T, target: WritableSignal<string | null>): (source: Observable<T>) => Observable<T> {
    return catchError((err: any) => {
        console.error(err);
        (target).set(message);
        return of(ret);
    });
}