import { Component } from '@angular/core';
import { HeaderComponent } from './core/header/header.component';
import { MainComponent } from './core/main/main.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent, MainComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'app-monitor';
}
