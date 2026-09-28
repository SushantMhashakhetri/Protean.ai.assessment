import { Injectable } from '@angular/core';
import type { EventSetup } from '../shared/event.model';

@Injectable({ providedIn: 'root' })
export class EventSetupApi {
  async save(value: EventSetup): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.info('[EventSetupApi] saved', value);
  }
}
