import { getHealthPayload } from './_lib/core.js';

export function GET(): Response {
  return Response.json(getHealthPayload(), { status: 200 });
}
