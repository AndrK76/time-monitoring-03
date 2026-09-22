import { Component, input, output, inject, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RoleWithPermissionsInfo } from '../role-view.models';
import { PermissionResponseDto } from '@mon3/sa';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { rolePermissionsWithInfo } from '../role-view.utils';

@Component({
  selector: 'app-role-editor-inplace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './role-editor-inplace.component.html',
  styleUrl: './role-editor-inplace.component.scss'
})
export class RoleEditorInplaceComponent implements OnInit {
  roleData = input.required<RoleWithPermissionsInfo>();
  permissions = input.required<PermissionResponseDto[]>();
  change = output<RoleWithPermissionsInfo>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  data!: RoleWithPermissionsInfo;

  ngOnInit(): void {
    this.buildForm();
    this.listenToChanges();
  }

  private buildForm(): void {
    this.data = this.roleData();
    this.form = this.fb.group({
      id: [{ value: this.data.id, disabled: true }],
      name: [this.data.name, Validators.required],
      description: [this.data.description],
      permissions: [this.data.permissions || []]
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
        const updated: RoleWithPermissionsInfo = {
          id: this.roleData().id,
          name: values.name,
          description: values.description || '',
          permissions: values.permissions || [],
          special: false,
          permissionsWithInfo: rolePermissionsWithInfo((values.permissions ? values : this.data), this.permissions())
        };
        this.change.emit(updated);
      });
  }

}