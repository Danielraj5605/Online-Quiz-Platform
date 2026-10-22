import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';

/**
 * Route-level code splitting. Usage in a feature's routes file:
 *   { path: '/discover', ...page(() => import('./pages/Discover')) }
 * The page module must `export default` its component.
 */
export const page = (loader: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await loader()).default }),
});
