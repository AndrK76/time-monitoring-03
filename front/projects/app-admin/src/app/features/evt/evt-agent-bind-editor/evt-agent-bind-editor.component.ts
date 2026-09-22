import { Component, input, output, inject, DestroyRef, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DialogService, isNewItem, isNotFullLoadedItem } from '@mon3/sc';
import { PermissionService } from '@mon3/sa';

import { authConstant } from '../../../auth-constants';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { EvtAgentItemView, EvtAgentTypeView } from '../evt-view.models';
import { evtAgentTypeFromId, evtOrgStructFromId } from '../evt-view.utils';

@Component({
  selector: 'app-evt-agent-bind-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule,
    MatIconModule, MatSelectModule, MatProgressSpinnerModule,
  ],
  templateUrl: './evt-agent-bind-editor.component.html',
  styleUrl: './evt-agent-bind-editor.component.scss',
})
export class EvtAgentBindEditorComponent implements OnInit {

  private readonly permisService = inject(PermissionService);
  private dialogService = inject(DialogService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  agentData = input.required<EvtAgentItemView>();
  loadItemFn = input.required<(item: EvtAgentItemView) => Observable<EvtAgentItemView | undefined>>();
  agentTypes = input.required<EvtAgentTypeView[]>();
  organizations = input.required<OrgStructInfo[]>();
  curOrg = input.required<string | undefined>();

  currOrgName = computed(() => {
    if (!this.curOrg()) return '';
    const org = this.organizations().find(f => f.id === this.curOrg());
    return org ? org.shortName : '';
  });

  orgIsCurrOrg = computed(() => {
    if (!this.curOrg() || !this.valueOrganizationId()) return false;
    return (this.curOrg() === this.valueOrganizationId());
  });

  loaded = output<EvtAgentItemView>();
  change = output<EvtAgentItemView>();

  form!: FormGroup;
  data!: EvtAgentItemView;

  loading = signal<boolean>(false);
  isNew = signal<boolean>(false);
  canFullChange = signal<boolean>(false);

  private valueAgentType = signal<string>('');
  private valueName = signal<string>('');
  private valueDescription = signal<string | undefined>(undefined);
  valueOrganizationId = signal<string | undefined>('');

  ngOnInit(): void {
    this.canFullChange.set(this.permisService.checkPermissions(authConstant('structModifyAgents')));
    this.data = this.agentData();
    this.buildForm();
    this.loadDetails();
  }

  private buildForm(): void {
    this.isNew.set(isNewItem<EvtAgentItemView>(this.data));
    this.form = this.fb.group({
      name: [{ value: this.data.name, disabled: false }],
      agentType: [{
        value: this.data.agentTypeWithInfo?.value || this.data.agentType || '',
        disabled: !this.isNew() || !this.canFullChange()
      }],
      description: [{ value: this.data.description, disabled: false }],
      organizationName: [{ value: this.data.organization?.shortName || '', disabled: true }],
      configured: [{ value: this.data.configured || false, disabled: true }],
    });
  }

  private loadDetails(): void {
    if (isNotFullLoadedItem(this.data) && !isNewItem(this.data)) {
      this.loading.set(true);
      this.loadItemFn()(this.data)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            if (data) {
              this.data = data;
              this.loaded.emit(this.data);
              this.loading.set(false);
              this.buildForm();
              this.listenToChanges();
            }
          },
          error: () => {
            // оставляем спиннер — ошибка обрабатывается в родителе
          },
        });
    } else {
      this.listenToChanges();
    }
  }

  private listenToChanges(): void {
    this.valueAgentType.set(this.data.agentType);
    this.valueName.set(this.data.name);
    this.valueDescription.set(this.data.description);
    this.valueOrganizationId.set(this.data.organizationId);

    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => this.form.valid),
        filter(values => values && typeof values === 'object'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        this.valueAgentType.set(values.agentType || this.data.agentType);
        this.valueName.set(values.name);
        this.valueDescription.set(values.description);
        this.emitChange();
      });
  }

  emitChange(): void {
    const updated: EvtAgentItemView = {
      id: this.data.id,
      organizationId: this.valueOrganizationId(),
      organization: evtOrgStructFromId(this.valueOrganizationId(), this.organizations()),
      agentType: this.valueAgentType(),
      agentTypeWithInfo: evtAgentTypeFromId(this.valueAgentType(), this.agentTypes()),
      name: this.valueName(),
      description: this.valueDescription(),
      configured: this.data.configured,
      config: this.data.config,
      places: this.data.places,
    };
    this.change.emit(updated);
  }

  callUnBind(): void {
    this.dialogService.confirm(
      `Удалить привязку агента "${this.data.name}" от организации "${this.data.organization?.shortName}"?`
    ).subscribe(confirmed => {
      if (confirmed) {
        this.valueOrganizationId.set(undefined);
        this.form.patchValue({ organizationName: '' });
        this.emitChange();
      }
    });
  }

  callBind(): void {
    this.dialogService.confirm(
      `Создать привязку агента "${this.data.name}" к организации "${this.currOrgName()}"?`
    ).subscribe(confirmed => {
      if (confirmed) {
        this.valueOrganizationId.set(this.curOrg());
        this.form.patchValue({ organizationName: this.currOrgName() });
        this.emitChange();
      }
    });
  }
}