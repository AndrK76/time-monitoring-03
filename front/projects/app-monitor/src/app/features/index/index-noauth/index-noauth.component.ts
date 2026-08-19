import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterModule } from '@angular/router';
import { AuthService } from '@mon3/sa';

@Component({
  selector: 'app-index-noauth',
  standalone: true,
  imports: [MatButtonModule, RouterLink, RouterModule],
  templateUrl: './index-noauth.component.html',
  styleUrl: './index-noauth.component.scss'
})
export class IndexNoAuthComponent implements OnInit {

  private authService = inject(AuthService);
  isAuthenticated = signal(false);

  ngOnInit(): void {
    this.authService.onAuthChange((authenticated) => {
      this.isAuthenticated.set(authenticated);
    });
    this.isAuthenticated.set(this.authService.isAuthenticated);
  }
}