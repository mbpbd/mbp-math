import { detectSmsProvider, handleSendSmsRequest, readJsonBody } from './_lib/core.js';

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return Response.json(
      {
        sent: false,
        configured: Boolean(detectSmsProvider()),
        error: parsed.error
      },
      { status: parsed.status }
    );
  }

  const result = await handleSendSmsRequest({
    authorizationHeader: request.headers.get('authorization'),
    body: parsed.body
  });
  return Response.json(result.body, { status: result.status });
}
