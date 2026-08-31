// shared-components/src/lib/services/dialog.service.ts
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogCancelComponent, ConfirmDialogCancelData, ConfirmDialogCancelResult } from '../components/confirm-dialog-cancel/confirm-dialog-cancel.component';
import { ChangePasswordDialogData, ChangePasswordDialogResult } from '../components/change-password-dialog/change-password-dialog.model';
import { ChangePasswordDialogComponent } from '../components/change-password-dialog/change-password-dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogService {
    constructor(private dialog: MatDialog) { }

    confirm(message: string, title?: string): Observable<boolean> {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { title, message },
            width: '400px',
            autoFocus: false,
        });
        return dialogRef.afterClosed();
    }

    confirmWithCancel(message: string, title?: string, yesLabel?: string, noLabel?: string, cancelLabel?: string)
        : Observable<ConfirmDialogCancelResult> {
        const data = new ConfirmDialogCancelData(message, title, yesLabel, noLabel, cancelLabel);
        const dialogRef = this.dialog.open(ConfirmDialogCancelComponent, {
            data,
            width: '400px',
            autoFocus: false,
        });
        return dialogRef.afterClosed();
    }

    changePassword(data: ChangePasswordDialogData): Observable<ChangePasswordDialogResult> {
        const dialogRef = this.dialog.open(ChangePasswordDialogComponent, {
            data,
            width: '450px',
            autoFocus: false,
        });
        return dialogRef.afterClosed();
    }
}
