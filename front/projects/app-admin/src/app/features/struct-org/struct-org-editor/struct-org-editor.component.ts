// struct-org-editor.component.ts
import { Component, input, output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OrgStructInfo } from '../struct-org-view.models';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { DialogService } from '@mon3/sc';

@Component({
  selector: 'app-struct-org-editor',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, ReactiveFormsModule
  ],
  templateUrl: './struct-org-editor.component.html',
  styleUrl: './struct-org-editor.component.scss'
})
export class StructOrgEditorComponent implements OnInit {
  organization = input.required<OrgStructInfo>();
  canChangeInfo = input<boolean>(false);
  canChangeAgents = input<boolean>(false);

  change = output<OrgStructInfo>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private dialogService = inject(DialogService);
  private router = inject(Router);

  form!: FormGroup;
  data!: OrgStructInfo;

  ngOnInit(): void {
    this.data = this.organization();
    this.buildForm();
    this.listenToChanges();
  }

  private buildForm(): void {
    const disabled = !this.canChangeInfo();
    this.form = this.fb.group({
      shortName: [{ value: this.data.shortName, disabled }, Validators.required],
      fullName: [{ value: this.data.fullName, disabled }, Validators.required]
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
        const updated: OrgStructInfo = {
          ...this.data,
          shortName: values.shortName,
          fullName: values.fullName
        };
        this.change.emit(updated);
      });
  }

  resetForm(data: OrgStructInfo): void {
    this.data = data;
    this.form.patchValue({
      shortName: data.shortName,
      fullName: data.fullName
    }, { emitEvent: false });
  }

  // Обработчик кнопки "Выбрать" для CRM
  selectCrmAgent(): void {
    const orgId = this.organization().id;
    if (this.organization().crmAgentSet) {
      this.dialogService.confirm(
        'Агент уже выбран. Вы действительно хотите выбрать другой?',
        'Подтверждение'
      ).subscribe(confirmed => {
        if (confirmed) {
          this.router.navigate(['/crm/agent-list'], { queryParams: { org: orgId } });
        }
      });
    } else {
      this.router.navigate(['/crm/agent-list'], { queryParams: { org: orgId } });
    }
  }
}