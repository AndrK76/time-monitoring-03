import { Injectable, signal } from '@angular/core';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { TableDataChanges } from '../models/table-data-items';
import { newTableDataChanges } from '../utils/table-manage-utils';

@Injectable()
export class TableActionsInformerService {
  private readonly reloadSubject = new ReplaySubject<string>(1);
  private readonly addSubject = new Subject<void>();
  private readonly deleteSubject = new Subject<void>();
  private readonly refreshSubject = new Subject<void>();
  private readonly saveSubject = new Subject<void>();

  readonly reload$: Observable<string> = this.reloadSubject.asObservable();
  readonly add$: Observable<void> = this.addSubject.asObservable();
  readonly delete$: Observable<void> = this.deleteSubject.asObservable();
  readonly refresh$: Observable<void> = this.refreshSubject.asObservable();
  readonly save$: Observable<void> = this.saveSubject.asObservable();

  readonly hasChanges = signal(false);
  readonly canDelete = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingOther1 = signal(false);
  readonly dataState = signal<TableDataChanges>(newTableDataChanges());
  readonly totalCount = signal(0);

  triggerReload(agentId: string): void { this.reloadSubject.next(agentId); }
  triggerAdd(): void { this.addSubject.next(); }
  triggerDelete(): void { this.deleteSubject.next(); }
  triggerRefresh(): void { this.refreshSubject.next(); }
  triggerSave(): void { this.saveSubject.next(); }
}

export interface TableActionsCallbacks<T> {
  onTriggerAdd?: () => void;
  onTriggerDelete?: () => void;
  onTriggerRefresh?: () => void;
  onTriggerSave?: () => void;
  onTriggerReload?: (agentId: string) => void;
}