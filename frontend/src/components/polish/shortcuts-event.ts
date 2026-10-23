export const SHORTCUTS_EVENT = 'quizzo:shortcuts';
/** Opens the shortcuts dialog from anywhere (command palette, menus, buttons). */
export const openShortcuts = () => window.dispatchEvent(new Event(SHORTCUTS_EVENT));
