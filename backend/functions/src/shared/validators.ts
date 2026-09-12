import { HttpsError } from 'firebase-functions/v2/https';
import { ZodSchema, ZodError } from 'zod';

// We assume @comiclink/validation provides schemas, exporting dummy ones if it doesn't exist yet to satisfy type checker.
// In a real scenario, this would be: import * as schemas from '@comiclink/validation';

export function validateInput<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new HttpsError('invalid-argument', `Validation failed: ${issues}`);
    }
    throw new HttpsError('invalid-argument', 'Invalid input provided.');
  }
}
