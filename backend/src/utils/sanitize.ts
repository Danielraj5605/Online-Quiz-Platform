import xss from 'xss';

// Sanitize HTML to prevent XSS attacks
const xssOptions = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

export const sanitizeString = (input: string): string => {
  return xss(input, xssOptions).trim();
};

export const sanitizeObject = <T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): Partial<T> => {
  const sanitized: Partial<T> = {};
  for (const field of fields) {
    if (typeof obj[field] === 'string') {
      (sanitized as Record<string, unknown>)[field as string] = sanitizeString(obj[field] as string);
    }
  }
  return sanitized;
};
