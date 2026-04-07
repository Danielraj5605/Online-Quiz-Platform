import { ZodObject } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateBody = (schema: ZodObject<any>) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues.map((e: any) => e.message).join(', ') });
  }
  req.body = result.data;
  next();
};
