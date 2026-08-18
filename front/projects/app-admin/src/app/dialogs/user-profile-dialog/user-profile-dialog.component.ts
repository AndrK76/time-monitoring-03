import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ViewCurrentProfileComponent } from '@mon3/sc';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    ViewCurrentProfileComponent
  ],
  templateUrl: './user-profile-dialog.component.html',
  styleUrl: './user-profile-dialog.component.scss'
})
export class UserProfileDialogComponent implements OnInit {

  public dialogRef = inject(MatDialogRef<UserProfileDialogComponent>);
  private breakpointObserver = inject(BreakpointObserver);

  isXSmall = signal(false);

  ngOnInit(): void {
    this.breakpointObserver.observe([Breakpoints.XSmall])
      .subscribe(result => {
        this.isXSmall.set(result.matches);
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}