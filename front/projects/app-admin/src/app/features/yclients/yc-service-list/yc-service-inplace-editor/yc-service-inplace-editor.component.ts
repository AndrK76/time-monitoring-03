import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { YClientsServiceCategoryListView, YClientsServiceView } from '../../yclients-view.models';
import { isNewItem } from '@mon3/sc';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-yc-service-inplace-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule
  ],
  templateUrl: './yc-service-inplace-editor.component.html',
  styleUrl: './yc-service-inplace-editor.component.scss'
})
export class YcServiceInplaceEditorComponent implements OnInit {
  serviceData = input.required<YClientsServiceView>();
  categories = input<YClientsServiceCategoryListView[]>([]);

  change = output<YClientsServiceView>();
  delete = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  data!: YClientsServiceView;

  canDelete = (): boolean => isNewItem(this.data);

  ngOnInit(): void {
    this.data = this.serviceData();
    this.buildForm();
    this.listenToChanges();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      ycId: [{ value: this.data.ycId, disabled: true }],
      ycName: [{ value: this.data.ycName, disabled: true }],
      name: [{ value: this.data.name ?? '', disabled: false }],
      categoryName: [{ value: this.data.categoryWithInfo?.name ?? '', disabled: true }],
    });
  }

  private listenToChanges(): void {
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => this.form.valid),
        filter(values => values && typeof values === 'object'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const updated: YClientsServiceView = {
          ...this.data,
          name: values.name,
        };
        this.change.emit(updated);
      });
  }

  callDelete(): void {
    this.delete.emit();
  }
}