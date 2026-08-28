import { Component, computed, inject } from '@angular/core';
import { AuthService } from '@mon3/sa';
import { IndexAuthComponent } from './index-auth/index-auth.component';
import { IndexNoAuthComponent } from './index-noauth/index-noauth.component';

@Component({
  selector: 'app-index',
  standalone: true,
  imports: [IndexAuthComponent, IndexNoAuthComponent],
  templateUrl: './index.component.html',
  styleUrl: './index.component.scss'
})
export class IndexComponent {
  private authService = inject(AuthService);
  protected isAuthenticated = computed(() => this.authService.isAuthenticated);
}
