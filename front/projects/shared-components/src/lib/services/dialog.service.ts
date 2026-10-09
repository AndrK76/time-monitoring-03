// shared-components/src/lib/services/dialog.service.ts
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, tap } from 'rxjs';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogCancelComponent, ConfirmDialogCancelData, ConfirmDialogCancelResult } from '../components/confirm-dialog-cancel/confirm-dialog-cancel.component';
import { ChangePasswordDialogData, ChangePasswordDialogResult } from '../components/change-password-dialog/change-password-dialog.model';
import { ChangePasswordDialogComponent } from '../components/change-password-dialog/change-password-dialog.component';
import { LoginDialogData, LoginDialogResult } from '../components/login-dialog/login-dialog.model';
import { LoginDialogComponent } from '../components/login-dialog/login-dialog.component';
import { ShowImageDialogComponent, ShowImageRectangle } from '../components/show-image-dialog/show-image-dialog.component';
import { SelectValueDialogComponent, SelectValueDialogData, SelectValueDialogResult } from '../components/select-value-dialog/select-value-dialog.component';

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

    loginDialog(data: LoginDialogData): Observable<LoginDialogResult> {
        const dialogRef = this.dialog.open(LoginDialogComponent, {
            data,
            width: '450px',
            autoFocus: false,
        });
        return dialogRef.afterClosed();
    }


    showImage(blob: Blob, title: string, addInfo?: any): Observable<void> {
        const url = URL.createObjectURL(blob);
        const greenRectangles: ShowImageRectangle[] | undefined =
            addInfo?.greenRectangles ?? (addInfo?.greenRectangle ? [addInfo.greenRectangle] : undefined);
        const dialogRef = this.dialog.open(ShowImageDialogComponent, {
            data: { url: url, title: title, greenRectangles: greenRectangles },
            maxWidth: '95vw',
            maxHeight: '95vh',
            autoFocus: false,
        });
        return dialogRef.afterClosed().pipe(
            tap(() => URL.revokeObjectURL(url)),
        );
    }

    selectValue(data: SelectValueDialogData): Observable<SelectValueDialogResult> {
        const dialogRef = this.dialog.open(SelectValueDialogComponent, {
            data,
            width: '450px',
            autoFocus: false,
        });
        return dialogRef.afterClosed();
    }
}
