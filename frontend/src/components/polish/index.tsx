import { KeyboardShortcuts } from './keyboard-shortcuts';
import { RouteProgress } from './route-progress';


/** Mounted once at the router root: navigation progress + the global `?` shortcuts dialog. */
export function GlobalPolish() {
  return (
    <>
      <RouteProgress />
      <KeyboardShortcuts />
    </>
  );
}
