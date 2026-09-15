import { Injectable, signal } from '@angular/core';
import { Observable, ReplaySubject, Subject } from 'rxjs';

@Injectable()
export class CrmServiceActionsService {

  private readonly reloadSubject = new ReplaySubject<string>(1);

  private readonly addSubject = new Subject<void>();
  private readonly deleteSubject = new Subject<void>();
  private readonly refreshSubject = new Subject<void>();
  private readonly saveSubject = new Subject<void>();

  readonly add$: Observable<void> = this.addSubject.asObservable();
  readonly delete$: Observable<void> = this.deleteSubject.asObservable();
  readonly refresh$: Observable<void> = this.refreshSubject.asObservable();
  readonly save$: Observable<void> = this.saveSubject.asObservable();
  readonly reload$ = this.reloadSubject.asObservable();

  readonly hasChanges = signal(false);
  readonly canDelete = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingFromCrm = signal(false);

  triggerReload(agentId: string): void { this.reloadSubject.next(agentId); }

  triggerAdd(): void { this.addSubject.next(); }
  triggerDelete(): void { this.deleteSubject.next(); }
  triggerRefresh(): void { this.refreshSubject.next(); }
  triggerSave(): void { this.saveSubject.next(); }
}