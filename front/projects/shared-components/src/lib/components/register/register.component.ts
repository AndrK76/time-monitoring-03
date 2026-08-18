import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, RegistrationRequestDto } from '@mon3/sa';

@Component({
  selector: 'sc-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  userData: RegistrationRequestDto = {
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    displayName: ''
  };
  isLoading = false;

  onSubmit() {
    this.isLoading = true;
    this.authService.register(this.userData).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Registration failed', err);
        // Здесь можно добавить отображение ошибки
      }
    });
  }
}