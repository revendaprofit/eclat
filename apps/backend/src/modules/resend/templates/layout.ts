// Moldura comum dos e-mails da marca. HTML de e-mail é o de 2005: tabelas, estilo inline,
// largura fixa de 600px — é o que Gmail, Outlook e Apple Mail renderizam igual.
// Cores = tokens da vitrine (apps/storefront/tailwind.config.js → eclat.*).

export const COR = {
  luz: "#FAF8F3",
  areia: "#EDE3D1",
  pedra: "#C9BFAE",
  grafite: "#2B2A28",
  terracota: "#7A3B2C",
  blushClaro: "#F3DFD3",
}

export const SERIFA = "Georgia, 'Times New Roman', serif"
export const SEM_SERIFA = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function layout(p: { previa: string; corpo: string; lojaUrl: string; whatsapp: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>use.ÉCLAT</title>
</head>
<body style="margin:0;padding:0;background:${COR.areia};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(p.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.areia};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${COR.luz};">
<tr><td align="center" style="padding:36px 32px 28px;border-bottom:1px solid ${COR.areia};">
<a href="${esc(p.lojaUrl)}" style="text-decoration:none;"><img src="${esc(p.lojaUrl)}/brand/logo-terracota.png" width="132" alt="use.ÉCLAT" style="display:block;border:0;width:132px;height:auto;"></a>
</td></tr>
<tr><td style="padding:36px 32px 8px;font-family:${SEM_SERIFA};color:${COR.grafite};font-size:15px;line-height:1.6;">
${p.corpo}
</td></tr>
<tr><td style="padding:28px 32px 36px;font-family:${SEM_SERIFA};color:${COR.grafite};font-size:13px;line-height:1.6;border-top:1px solid ${COR.areia};">
Ficou com alguma dúvida? Responda este e-mail ou <a href="https://wa.me/${esc(p.whatsapp)}" style="color:${COR.terracota};">fale com a gente no WhatsApp</a>.
<br><br>
<span style="color:#8A8378;">use.ÉCLAT · <a href="${esc(p.lojaUrl)}" style="color:#8A8378;">${esc(p.lojaUrl.replace(/^https?:\/\/(www\.)?/, ""))}</a></span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
