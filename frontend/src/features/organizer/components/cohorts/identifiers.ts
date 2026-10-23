/** usernames or emails separated by commas, spaces, semicolons or new lines */
export const parseIdentifiers = (text: string) =>
  [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 500);
