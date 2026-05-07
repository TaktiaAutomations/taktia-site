# Chatbot n8n da Taktia

Arquivo inicial de importacao: `n8n/taktia-chatbot-agent.json`

Fluxo proposto:

1. O site envia a mensagem para `POST /api/chat`.
2. O servidor encaminha para o webhook do n8n definido em `N8N_CHAT_WEBHOOK_URL`.
3. O workflow prepara a entrada, aplica memoria curta por `sessionId`, chama o agente OpenAI e devolve `{ "reply": "..." }`.

Configuracao minima:

1. Importe `n8n/taktia-chatbot-agent.json` no n8n.
2. Configure a credencial `OpenAI` no node `OpenAI Model`.
3. Ative o workflow e copie a URL de producao do webhook `taktia-chat`.
4. No servidor do site, defina `N8N_CHAT_WEBHOOK_URL=https://SEU-N8N/webhook/taktia-chat`.
5. Reinicie a aplicacao.

Payload esperado pelo workflow:

```json
{
  "message": "Quero automatizar meu atendimento",
  "sessionId": "uuid-da-conversa",
  "pageUrl": "https://taktia.com.br/",
  "history": [
    { "role": "user", "content": "Oi" },
    { "role": "assistant", "content": "Como posso ajudar?" }
  ]
}
```

Resposta esperada:

```json
{
  "reply": "Podemos estruturar isso via chatbot com IA, integracao ao CRM e escalonamento humano.",
  "source": "n8n",
  "sessionId": "uuid-da-conversa"
}
```

Proximo nivel recomendado:

1. Adicionar ferramenta de busca em base de conhecimento da Taktia.
2. Registrar leads em CRM quando detectar intencao comercial alta.
3. Encaminhar para humano no n8n quando o usuario pedir proposta ou demonstracao.