import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { LoginRequestDto } from '@mon3/sa';

@Component({
  selector: 'sc-login-dialog-content',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './login-dialog-content.component.html',
  styleUrl: './login-dialog-content.component.scss'
})
export class LoginDialogContentComponent {
  title = input<string>('Вход в систему');
  submitLabel = input<string>('Войти');
  cancelLabel = input<string>('Отмена');
  extraLinkLabel = input<string | undefined>(undefined);
  extraLinkRoute = input<string | undefined>(undefined);
  isLoading = input<boolean>(false);
  errorMessage = input<string | null>(null);

  submitted = output<LoginRequestDto>();
  cancelled = output<void>();

  credentials: LoginRequestDto = { username: '', password: '' };

  onSubmit(form: any): void {
    if (form.invalid) return;
    this.submitted.emit({ ...this.credentials });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}