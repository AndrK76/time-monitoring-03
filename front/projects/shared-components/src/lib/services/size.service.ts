import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SizeService {

  private breakpointObserver = inject(BreakpointObserver);
  private _smallSizeSubscription: Subscription | undefined = undefined;

  isSmallScreen = signal(false);

  breakpointsSubscribe() {
    if (!this._smallSizeSubscription) {
      this._smallSizeSubscription = this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small])
        .subscribe(result => {
          this.isSmallScreen.set(result.matches);
        });
    }
  }

  constructor() { }
}
