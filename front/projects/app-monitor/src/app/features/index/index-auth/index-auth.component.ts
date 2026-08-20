import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { SampleData } from '../../../models/sample-data-model';
import { SampleDataService } from '../../../services/sample-data.service';

@Component({
  selector: 'app-index-auth',
  standalone: true,
  imports: [],
  templateUrl: './index-auth.component.html',
  styleUrl: './index-auth.component.scss'
})
export class IndexAuthComponent implements OnInit {
  private readonly dataService = inject(SampleDataService);;

  data: WritableSignal<SampleData | undefined> = signal(undefined);

  ngOnInit(): void {
    this.dataService.getData(false).subscribe({
      next: (res) => this.data.set(res),
      error: (err) => console.log(err),
    });
  }

}
