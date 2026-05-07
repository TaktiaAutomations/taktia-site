# Setup do Chat com OpenAI (sem n8n)

Este projeto agora responde o chat via backend em `/api/chat`, chamando a API da OpenAI diretamente.

## 1) Criar API key

1. Acesse https://platform.openai.com/
2. Crie uma API key em **API keys**.
3. Defina limite de uso/budget no projeto para controlar custo.

## 2) Configurar variaveis de ambiente

Copie `.env.example` para `.env` e preencha:

- `OPENAI_API_KEY` (obrigatoria)
- `OPENAI_MODEL` (opcional, padrao `gpt-4o-mini`)
- `CONTACT_WEBHOOK_URL` (opcional, para formulario de contato via n8n)
- `CONTACT_WEBHOOK_METHOD` (opcional, `GET` ou `POST`; padrao `GET`)
- `CONTACT_WEBHOOK_BASIC_USER` e `CONTACT_WEBHOOK_BASIC_PASS` (opcional, auth basic)
- `CONTACT_WEBHOOK_BEARER_TOKEN` (opcional, auth bearer)
- `CONTACT_WEBHOOK_AUTH_HEADER` e `CONTACT_WEBHOOK_AUTH_VALUE` (opcional, header customizado)

Exemplo:

```env
OPENAI_API_KEY=sk-sua-chave-aqui
OPENAI_MODEL=gpt-4o-mini
CONTACT_WEBHOOK_URL=https://n8n.seudominio.com/webhook/sitetaktia
CONTACT_WEBHOOK_METHOD=GET
# CONTACT_WEBHOOK_BASIC_USER=usuario
# CONTACT_WEBHOOK_BASIC_PASS=senha
# CONTACT_WEBHOOK_BEARER_TOKEN=token
# CONTACT_WEBHOOK_AUTH_HEADER=x-webhook-secret
# CONTACT_WEBHOOK_AUTH_VALUE=seu-segredo
```

## 3) Rodar aplicacao

Instale dependencias e rode normalmente:

```bash
corepack pnpm install
corepack pnpm dev
```

## 4) Sobre o agente no backend

O agente fica no endpoint `POST /api/chat` e inclui:

- System prompt robusto focado em atendimento comercial da Taktia.
- Memoria curta por sessao (`sessionId`) no backend.
- Resposta com fallback amigavel em caso de falha.

O formulario de contato envia para `POST /api/contact`, e o backend repassa para `CONTACT_WEBHOOK_URL`.

Resposta esperada da API:

```json
{
  "reply": "texto da resposta",
  "source": "openai",
  "model": "gpt-4o-mini",
  "sessionId": "id-da-sessao"
}
```

## 5) Modelo recomendado (barato e rapido)

- Padrao atual: `gpt-4o-mini`.
- Boa relacao custo x velocidade para chat de site.

## 6) Boas praticas de producao

- Nunca exponha `OPENAI_API_KEY` no frontend.
- Mantenha rate limit no endpoint `/api/chat`.
- Adicione logs de erro e observabilidade (latencia, custo estimado, taxa de falha).
- Configure budget e alertas no painel da OpenAI.
