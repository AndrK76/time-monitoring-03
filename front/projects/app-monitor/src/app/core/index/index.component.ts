import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterModule } from '@angular/router';
import { AuthService } from '@mon3/sa';
import { MainComponent } from "../main/main.component";

@Component({
  selector: 'app-index',
  standalone: true,
  imports: [MatButtonModule, RouterLink, RouterModule, MainComponent],
  templateUrl: './index.component.html',
  styleUrl: './index.component.scss'
})
export class IndexComponent implements OnInit {

  private authService = inject(AuthService);
  isAuthenticated = signal(false);

  ngOnInit(): void {
    this.authService.onAuthChange((authenticated) => {
      this.isAuthenticated.set(authenticated);
    });
    this.isAuthenticated.set(this.authService.isAuthenticated);
  }
}