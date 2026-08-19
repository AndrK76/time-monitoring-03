import { Component, Input } from '@angular/core';
import { MenuItem } from '../../models/menu-item';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'sc-top-menu-item',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatMenuModule, RouterModule, MatIconModule],
  templateUrl: './top-menu-item.component.html',
  styleUrl: './top-menu-item.component.scss'
})
export class TopMenuItemComponent {
  @Input({ required: true }) item!: MenuItem;
  @Input() isSubmenu = false;

}
