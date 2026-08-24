import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
    constructor(private snackBar: MatSnackBar) { }

    success(message: string, duration: number = 3000): void {
        this.snackBar.open(message, 'Закрыть', {
            duration,
            panelClass: ['snackbar-success'],
            horizontalPosition: 'right',
            verticalPosition: 'top',
        });
    }

    error(message: string, duration: number = 5000): void {
        this.snackBar.open(message, 'Закрыть', {
            duration,
            panelClass: ['snackbar-error'],
            horizontalPosition: 'right',
            verticalPosition: 'top',
        });
    }

    info(message: string, duration: number = 3000): void {
        this.snackBar.open(message, 'Закрыть', {
            duration,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'right',
            verticalPosition: 'top',
        });
    }

    warning(message: string, duration: number = 4000): void {
        this.snackBar.open(message, 'Закрыть', {
            duration,
            panelClass: ['snackbar-warning'],
            horizontalPosition: 'right',
            verticalPosition: 'top',
        });
    }
}