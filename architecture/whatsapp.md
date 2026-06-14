# architecture/whatsapp.md — SOP do WhatsApp (Evolution API) — Parte 6

> Decisão 2026-06-14: WhatsApp via **Evolution API** (self-hosted no Railway), instância dedicada `eclat`.
> Estado: **integração montada e versionada; falta conectar o WhatsApp (QR) e testar** (adiado pelo usuário).

## Arquitetura
```
WhatsApp da marca ⇄ Evolution API (instância "eclat") ⇄ Backend Medusa ⇄ Supabase
                         QR p/ conectar                  webhook (recebe) → lead + conversa
                                                          REST (envia)    ← service_role
```
Invariante 2: o backend é o orquestrador; quem guarda relacionamento é o Supabase.

## Componentes (no repo)
- `apps/backend/src/lib/supabase.ts` — escrita no Supabase via service_role (getOrCreateLeadByWhatsapp, insertConversa).
- `apps/backend/src/lib/evolution.ts` — envio de mensagens (sendWhatsappText).
- `apps/backend/src/api/webhooks/whatsapp/route.ts` — POST recebe `messages.upsert` → grava lead+conversa;
  GET = healthcheck. Valida `?token=` contra WHATSAPP_WEBHOOK_SECRET. Ignora grupos/status. Sempre responde 200.

## Config (.env do backend — NÃO versionado)
- EVOLUTION_API_URL = https://evolution-api-production-75e6.up.railway.app
- EVOLUTION_API_KEY = (global AUTHENTICATION_API_KEY)
- EVOLUTION_INSTANCE = eclat
- EVOLUTION_INSTANCE_TOKEN = (token próprio da instância eclat)
- WHATSAPP_WEBHOOK_SECRET = (token validado na query do webhook)

## Instância Evolution
- Criada via POST /instance/create {instanceName:"eclat", integration:"WHATSAPP-BAILEYS", qrcode:true}.
- Manager: https://evolution-api-production-75e6.up.railway.app/manager (login com a API key).

## Como RETOMAR (conectar + testar)
1. Subir o backend (apps/backend: npm run dev) — porta 9000.
2. Subir o túnel (cloudflared instalado em ...\WinGet\Packages\Cloudflare.cloudflared...\cloudflared.exe):
   `cloudflared tunnel --url http://localhost:9000` → copiar a URL https://<x>.trycloudflare.com.
   (A URL do quick tunnel MUDA a cada execução → reconfigurar o webhook.)
3. Reconfigurar o webhook da instância:
   `POST {EVO}/webhook/set/eclat` com {webhook:{enabled:true, url:"<TUNEL>/webhooks/whatsapp?token=<SECRET>",
   webhookByEvents:false, events:["MESSAGES_UPSERT"]}} e header apikey.
4. Conectar o WhatsApp: GET {EVO}/instance/connect/eclat (gera QR) OU pelo Manager → escanear com o
   celular da marca (Aparelhos conectados → Conectar aparelho). Conferir: GET {EVO}/instance/connectionState/eclat → "open".
5. Testes:
   - Inbound: enviar msg de outro número para o WhatsApp da marca → conferir lead+conversa(entrada) no Supabase.
   - Outbound: chamar sendWhatsappText(numeroComDDI, "...") → conferir conversa(saida).

## Produção (futuro)
- Trocar o quick tunnel por túnel/host fixo (deploy do backend ou cloudflared nomeado) — URL estável p/ webhook.
- Usar um número dedicado da marca (risco de bloqueio do WhatsApp em API não-oficial).
