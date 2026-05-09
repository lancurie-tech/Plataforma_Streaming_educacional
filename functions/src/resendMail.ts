/**
 * Envio transacional via [Resend](https://resend.com) (HTTP).
 * Em produção: defina `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no ambiente da Cloud Function.
 */

export async function sendResendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
}
