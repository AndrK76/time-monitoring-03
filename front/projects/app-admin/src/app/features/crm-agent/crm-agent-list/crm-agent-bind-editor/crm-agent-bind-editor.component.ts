import { Component, input, output, inject, DestroyRef, OnInit, signal, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogService, isNewItem, isNotFullLoadedItem } from '@mon3/sc';
import { CrmAgentItemView, CrmAgentTypeView } from '../../crm-agent-view.models';
import { MatSelectModule } from '@angular/material/select';
import { PermissionService } from '@mon3/sa';
import { authConstant } from '../../../../auth-constants';
import { OrgStructInfo } from '../../../struct-org/struct-org-view.models';
import { agentTypeFromId, orgStructFromId } from '../../crm-agent-view.utils';

@Component({
  selector: 'app-crm-agent-bind-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule, MatIconModule, MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './crm-agent-bind-editor.component.html',
  styleUrl: './crm-agent-bind-editor.component.scss',
})
export class CrmAgentBindEditorComponent implements OnInit {
  private readonly permisService = inject(PermissionService);
  private dialogService = inject(DialogService);

  agentData = input.required<CrmAgentItemView>();
  loadItemFn = input.required<(item: CrmAgentItemView) => Observable<CrmAgentItemView | undefined>>();
  agentTypes = input.required<CrmAgentTypeView[]>();
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
  })

  loaded = output<CrmAgentItemView>();
  change = output<CrmAgentItemView>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  data!: CrmAgentItemView;

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
    this.isNew.set(isNewItem<CrmAgentItemView>(this.data));
    this.form = this.fb.group({
      name: [{ value: this.data.name, disabled: false }],
      agentType: [{ value: this.data.agentTypeWithInfo?.value || this.data.agentType || '', disabled: !this.isNew() || !this.canFullChange() }],
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
            //this.loading.set(false);
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

  emitChange() {
    const updated: CrmAgentItemView = {
      id: this.data.id,
      organizationId: this.valueOrganizationId(),
      organization: orgStructFromId(this.valueOrganizationId(), this.organizations()),
      agentType: this.valueAgentType(),
      agentTypeWithInfo: agentTypeFromId(this.valueAgentType(), this.agentTypes()),
      name: this.valueName(),
      description: this.valueDescription(),
      configured: this.data.configured,
      config: this.data.config,
      crmOrganization: this.data.crmOrganization,
      services: this.data.services,
    };
    this.change.emit(updated);
  }


  callUnBind(): void {
    this.dialogService.confirm(`Удалить привязку агента "${this.data.name} от организации ${this.data.organization?.shortName}"?`)
      .subscribe(confirmed => {
        if (confirmed) {
          this.valueOrganizationId.set(undefined);
          this.form.patchValue({ organizationName: '' });
          this.emitChange();
        }
      });
  }

  callBind(): void {
    this.dialogService.confirm(`Создать привязку агента "${this.data.name} к организации ${this.currOrgName()}"?`)
      .subscribe(confirmed => {
        if (confirmed) {
          this.valueOrganizationId.set(this.curOrg());
          this.form.patchValue({ organizationName: this.currOrgName() });
          this.emitChange();
        }
      });
  }



  onConfigure(): void {
    // Переход на страницу настройки агента
    // Пример: this.router.navigate(['/crm/agent', this.data.id]);
    console.warn('Configure agent');
  }


}