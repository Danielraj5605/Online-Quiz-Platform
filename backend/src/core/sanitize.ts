import xss from 'xss';

/** Strips all HTML. Applied to every free-text field before storage. */
export const clean = (s: string) => xss(s, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] }).trim();
export const cleanOpt = (s: string | null | undefined) => (s == null ? s : clean(s));
