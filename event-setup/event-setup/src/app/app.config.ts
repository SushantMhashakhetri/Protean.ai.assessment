import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideSignalFormsConfig } from '@angular/forms/signals';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Signal Forms does not apply ng-* classes unless you ask for them.
    provideSignalFormsConfig({
      classes: {
        'ng-invalid': ({ state }) => state().invalid(),
        'ng-touched': ({ state }) => state().touched(),
        'ng-dirty': ({ state }) => state().dirty(),
      },
    }),
  ],
};
