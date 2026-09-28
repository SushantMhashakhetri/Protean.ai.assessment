import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EventSetupComponent } from './event-setup/event-setup.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EventSetupComponent],
  template: `<app-event-setup />`,
})
export class App {}
