if (typeof global !== 'undefined' && !global.ErrorUtils) {
  let _h = () => {};
  global.ErrorUtils = {
    setGlobalHandler: (h) => { _h = h; },
    getGlobalHandler: () => _h,
    reportError: (e) => console.error(e),
    reportFatalError: (e) => console.error(e),
    applyWithGuard: (fn, ctx, args) => fn.apply(ctx, args),
    applyWithGuardIfNeeded: (fn, ctx, args) => fn.apply(ctx, args),
    inGuard: () => false,
    guard: (fn) => fn,
  };
}

import { registerRootComponent } from 'expo';
import MobileApp from './src/MobileApp.tsx';

registerRootComponent(MobileApp);
