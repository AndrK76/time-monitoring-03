import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentItem, EventData, PlaceEventGroup, PlaceEvents, SampleData } from '../../../models/sample-data-model';
import { SampleDataService } from '../../../services/sample-data.service';


@Component({
  selector: 'app-index-auth',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './index-auth.component.html',
  styleUrl: './index-auth.component.scss'
})
export class IndexAuthComponent implements OnInit {
  private readonly dataService = inject(SampleDataService);;

  data: WritableSignal<SampleData | undefined> = signal(undefined);
  activeDate = signal<Date>(new Date());

  schedulerEvents = signal<any[]>([]);


  ngOnInit(): void {
    this.dataService.getData(false).subscribe({
      next: (res) => {
        this.data.set(res);
        if (res.content.length > 0 && res.content[0].group?.start) {
          const firstStart = new Date(res.content[0].group.start);
          if (!isNaN(firstStart.getTime())) {
            this.activeDate.set(firstStart);
          }
        }
      },
      error: (err) => console.log(err),
    });
  }

  /**
 * Обработка клика по событию
 */
  onEventClick(event: any): void {
    console.log('Clicked event:', event);
  }

}
