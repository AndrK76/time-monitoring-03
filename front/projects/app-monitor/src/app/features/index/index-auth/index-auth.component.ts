import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentItem, EventData, PlaceEventGroup, PlaceEvents, SampleData } from '../../../models/sample-data-model';
import { SampleDataService } from '../../../services/sample-data.service';
import { DayPilot, DayPilotModule } from '@daypilot/daypilot-lite-angular'


@Component({
  selector: 'app-index-auth',
  standalone: true,
  imports: [CommonModule, DayPilotModule],
  templateUrl: './index-auth.component.html',
  styleUrl: './index-auth.component.scss'
})
export class IndexAuthComponent implements OnInit {
  private readonly dataService = inject(SampleDataService);;

  data: WritableSignal<SampleData | undefined> = signal(undefined);

  schedulerEvents = signal<DayPilot.EventData[]>([]); // Типизированный сигнал для событий
  schedulerResources = signal<DayPilot.ResourceData[]>([]); // Сигнал для ресурсов

  // Конфигурация планировщика — startDate обязателен[reference:3]

  schedulerConfig = signal<any>({
    startDate: DayPilot.Date.today(),
    days: 7,
    scale: 'Hour',
    cellWidth: 60,
    rowHeaderWidth: 150,
    timeRange: { start: '00:00', end: '24:00' },
    hourWidth: 60,
    resourceColumns: [
      { name: 'Место', id: 'name', width: 150 }
    ],
    eventHeight: 30,
    locale: "ru-ru",
    snapToGrid: false,
    useEventBoxes: "Never",
    eventClickHandling: 'Enabled',
    eventMoveHandling: 'Disabled',
    eventResizeHandling: 'Disabled',
    eventDeleteHandling: 'Disabled',
    eventHoverHandling: 'Enabled',
    durationBarVisible: true,
    showToolTip: true,
    onEventClick: (args: any) => {
      console.log('Clicked event (from config):', args.e);
    },
    contextMenu: (new DayPilot.Menu({
      items: [
        { text: "Delete", onClick: (args) => { const dp = args.source.calendar; dp.events.remove(args.source); } }
      ]
    })),
  });


  ngOnInit(): void {
    this.dataService.getData(false).subscribe({
      next: (res) => {
        this.data.set(res);
        const minStart = res.content
          .flatMap(item => item.group.bars)
          .flatMap(bar => bar.events)
          .filter(evt => evt.status !== 'empty')
          .reduce((min, evt) => {
            const date = new Date(evt.start);
            return min && date > min ? min : date;
          }, null as Date | null)
        console.log(`min start: ${minStart}`);

        if (minStart) {
          //const dpDate = new DayPilot.Date(minStart);
          const minStartUTC = new Date(minStart + 'Z');
          const localStartOfDay = new Date(minStartUTC.getFullYear(), minStartUTC.getMonth(), minStartUTC.getDate());
          const dpDate = new DayPilot.Date(localStartOfDay, true); // isLocal = tru
          console.log(`dpDate: ${dpDate}`);
          this.schedulerConfig.set({
            ...this.schedulerConfig(),
            startDate: new DayPilot.Date(dpDate)
          });
          this.transformAndSetData(res);
        }
      },
      error: (err) => console.log(err),
    });
  }
  private transformAndSetData(data: SampleData): void {
    const resources: DayPilot.ResourceData[] = data.places.map(place => ({
      id: place.id,
      name: place.name
    }));
    this.schedulerResources.set(resources);

    // События
    const events: DayPilot.EventData[] = [];
    let counter = 0;

    data.content.forEach((item: ContentItem) => {
      const group = item.group;
      group.bars.forEach((bar: PlaceEvents) => {
        const placeId = bar.place;
        bar.events.forEach((evt: EventData) => {
          if (evt.status === 'empty') return;
          const colorMap: Record<string, string> = {
            'booked': '#a8d5e2',
            'booked-use': '#4caf50',
            'nobooked-use': '#f44336'
          };
          const color = colorMap[evt.status] || '#cccccc';
          const uniqueId = `${evt.booking_id || 'no-book'}-${counter++}`;
          events.push({
            id: uniqueId,
            resource: placeId,
            start: evt.start,
            end: evt.end,
            text: '',
            //text: evt.status,
            barColor: color,
            backColor: color,
            //barBackColor: color,
            barHidden: false,
            //html: '',
            toolTip: `${evt.status} (${placeId})`
          });
        });
      });
    });

    this.schedulerEvents.set(events);
  }


  onEventClick(args: any): void {
    console.log('Clicked event:', args.e);
  }

}
