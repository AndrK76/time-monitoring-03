import { Component } from '@angular/core';

@Component({
  selector: 'app-main',
  standalone: true,
  template: '<ng-content></ng-content>',
  styleUrl: './main.component.scss'
})
export class MainComponent { }