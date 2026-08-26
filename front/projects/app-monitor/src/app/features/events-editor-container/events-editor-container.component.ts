import { Component, input, output, inject, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EventsEditorInplaceComponent } from '../events-editor-inplace/events-editor-inplace.component';
import { EventRow } from '../event-row';
import { Place, EventStatus } from '../../models/sample-data-model';

@Component({
  selector: 'app-events-editor-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    EventsEditorInplaceComponent,
  ],
  templateUrl: './events-editor-container.component.html',
  styleUrl: './events-editor-container.component.scss'
})
export class EventsEditorContainerComponent {
  eventData = input.required<EventRow>();
  places = input.required<Place[]>();
  statuses = input.required<EventStatus[]>();
}