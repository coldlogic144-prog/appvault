"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInput = validateInput;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
// We assume @comiclink/validation provides schemas, exporting dummy ones if it doesn't exist yet to satisfy type checker.
// In a real scenario, this would be: import * as schemas from '@comiclink/validation';
function validateInput(schema, data) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
            throw new https_1.HttpsError('invalid-argument', `Validation failed: ${issues}`);
        }
        throw new https_1.HttpsError('invalid-argument', 'Invalid input provided.');
    }
}
//# sourceMappingURL=validators.js.map