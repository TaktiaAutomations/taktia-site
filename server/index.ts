import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createHmac } from "node:crypto";
import { registerLinkedinDiagnosticsRoutes } from "./linkedinDiagnostics";
import { registerLinkedinOAuthRoutes } from "./linkedinOAuth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  message?: string;
  sessionId?: string;
  pageUrl?: string;
  history?: ChatMessage[];
};

type ContactRequestBody = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  service?: string;
  message?: string;
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const DEFAULT_CHAT_ERROR =
  "Não consegui responder agora. Se preferir, fale com a equipe pelo WhatsApp (34) 99859-2724 ou pelo e-mail taktia@taktia.com.br.";
const DEFAULT_CONTACT_WEBHOOK_URL = "https://n8n.taktia.com.br/webhook/sitetaktia";
const DEFAULT_CONTACT_WEBHOOK_METHOD = "GET";
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_CONTEXT_MESSAGES = 12;
const SESSION_MEMORY_LIMIT = 16;

const sessionMemory = new Map<string, ChatMessage[]>();

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

function getOrCreateSessionId(rawSessionId?: string): string {
  const normalized = rawSessionId?.trim();
  if (normalized) {
    return normalized;
  }
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSystemPrompt(pageUrl?: string): string {
  const urlInfo = pageUrl?.trim() ? `Pagina atual do visitante: ${pageUrl.trim()}.` : "";

  return [
    "Voce e o Assistente Comercial da Taktia Automações.",
    "Responda sempre em portugues do Brasil, com clareza, objetividade e tom consultivo.",
    "",
    "Contexto da empresa:",
    "- Nome: Taktia Automações.",
    "- Servicos principais: Integracao de Plataformas, Atendimento com IA e Automacao de Atividades.",
    "- Cidade base: Uberlandia, MG.",
    "- Contatos: taktia@taktia.com.br e WhatsApp (34) 99859-2724.",
    "",
    "Objetivos do assistente:",
    "1) Tirar duvidas sobre servicos e abordagem da Taktia sem inventar informacoes.",
    "2) Qualificar interesse comercial com no maximo 2 perguntas relevantes quando necessario.",
    "3) Conduzir para proximo passo claro (contato comercial, reuniao, envio de proposta).",
    "",
    "Regras obrigatorias:",
    "- Nao invente cases, numeros, precos fechados, prazos fixos ou integracoes nao confirmadas.",
    "- Se faltar dado importante, diga explicitamente o que precisa para responder melhor.",
    "- Quando houver intencao comercial, convide para WhatsApp (34) 99859-2724 ou e-mail taktia@taktia.com.br.",
    "- Evite respostas longas demais; priorize respostas praticas e com proximo passo.",
    "- Se pedirem algo fora do escopo da Taktia, responda com transparencia e ofereca alternativa util.",
    "",
    urlInfo,
  ]
    .join("\n")
    .trim();
}

function trimChatHistory(history: ChatMessage[]): ChatMessage[] {
  return history
    .filter((entry) => entry.content.trim().length > 0)
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((entry) => ({ role: entry.role, content: entry.content.trim() }));
}

function buildOpenAIMessages(systemPrompt: string, history: ChatMessage[], message: string): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [{ role: "system", content: systemPrompt }];

  for (const item of history) {
    messages.push({ role: item.role, content: item.content });
  }

  messages.push({ role: "user", content: message });
  return messages;
}

async function createChatCompletion(
  apiKey: string,
  messages: OpenAIMessage[],
): Promise<{ reply: string | null; model: string | null }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 450,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${response.status}: ${errorBody || "erro sem detalhes"}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse & { model?: string };
  const reply = data.choices?.[0]?.message?.content?.trim() ?? null;
  return { reply, model: data.model ?? null };
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));

  app.post("/api/contact", async (req, res) => {
    const body = (req.body ?? {}) as ContactRequestBody;
    const name = body.name?.trim();
    const email = body.email?.trim();
    const message = body.message?.trim();

    if (!name || !email || !message) {
      res.status(400).json({ error: "Nome, e-mail e mensagem são obrigatórios." });
      return;
    }

    const webhookUrl = process.env.CONTACT_WEBHOOK_URL ?? DEFAULT_CONTACT_WEBHOOK_URL;
    const webhookMethod =
      (process.env.CONTACT_WEBHOOK_METHOD ?? DEFAULT_CONTACT_WEBHOOK_METHOD).toUpperCase() === "POST"
        ? "POST"
        : "GET";
    const basicUser = process.env.CONTACT_WEBHOOK_BASIC_USER?.trim();
    const basicPass = process.env.CONTACT_WEBHOOK_BASIC_PASS?.trim();
    const bearerToken = process.env.CONTACT_WEBHOOK_BEARER_TOKEN?.trim();
    const jwtSecret = process.env.CONTACT_WEBHOOK_JWT_SECRET?.trim();
    const authHeaderName = process.env.CONTACT_WEBHOOK_AUTH_HEADER?.trim();
    const authHeaderValue = process.env.CONTACT_WEBHOOK_AUTH_VALUE?.trim();

    const webhookPayload = {
      tipo: "formulario_contato",
      nome: name,
      email,
      telefone: body.phone?.trim() ?? "",
      empresa: body.company?.trim() ?? "",
      servico: body.service?.trim() ?? "",
      mensagem: message,
      data: new Date().toISOString(),
      origem: "site_taktia",
    };

    try {
      const upstreamUrl =
        webhookMethod === "GET"
          ? (() => {
              const url = new URL(webhookUrl);
              for (const [key, value] of Object.entries(webhookPayload)) {
                url.searchParams.set(key, value);
              }
              return url.toString();
            })()
          : webhookUrl;

      const upstreamResponse = await fetch(upstreamUrl, {
        method: webhookMethod,
        headers: (() => {
          const headers: Record<string, string> = {
            Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
          };

          if (webhookMethod === "POST") {
            headers["Content-Type"] = "application/json";
          }

          if (basicUser && basicPass) {
            headers.Authorization = `Basic ${Buffer.from(`${basicUser}:${basicPass}`).toString("base64")}`;
          } else if (jwtSecret) {
            const jwtHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
            const jwtPayload = Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000) })).toString("base64url");
            const sig = createHmac("sha256", jwtSecret).update(`${jwtHeader}.${jwtPayload}`).digest("base64url");
            headers.Authorization = `Bearer ${jwtHeader}.${jwtPayload}.${sig}`;
          } else if (bearerToken) {
            headers.Authorization = `Bearer ${bearerToken}`;
          }

          if (authHeaderName && authHeaderValue) {
            headers[authHeaderName] = authHeaderValue;
          }

          return headers;
        })(),
        body: webhookMethod === "POST" ? JSON.stringify(webhookPayload) : undefined,
        signal: AbortSignal.timeout(20000),
      });

      if (!upstreamResponse.ok) {
        const upstreamError = await upstreamResponse.text().catch(() => "");
        res.status(502).json({
          error: `Webhook retornou ${upstreamResponse.status}. ${upstreamError}`.trim(),
        });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(502).json({ error: details });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const body = (req.body ?? {}) as ChatRequestBody;
    const message = body.message?.trim();

    if (!message) {
      res.status(400).json({ error: "Mensagem obrigatória." });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "OPENAI_API_KEY nao configurada no servidor.",
        reply: DEFAULT_CHAT_ERROR,
      });
      return;
    }

    const sessionId = getOrCreateSessionId(body.sessionId);
    const inboundHistory = Array.isArray(body.history) ? body.history.filter(isChatMessage) : [];
    const memoryHistory = sessionMemory.get(sessionId) ?? [];
    const contextHistory = trimChatHistory(memoryHistory.length > 0 ? memoryHistory : inboundHistory);
    const systemPrompt = getSystemPrompt(body.pageUrl);
    const modelMessages = buildOpenAIMessages(systemPrompt, contextHistory, message);

    try {
      const completion = await createChatCompletion(apiKey, modelMessages);
      const reply = completion.reply;

      if (!reply) {
        res.status(502).json({
          error: "Resposta da OpenAI sem conteúdo utilizável.",
          reply: DEFAULT_CHAT_ERROR,
        });
        return;
      }

      const updatedHistory: ChatMessage[] = [
        ...contextHistory,
        { role: "user", content: message },
        { role: "assistant", content: reply },
      ];
      sessionMemory.set(sessionId, updatedHistory.slice(-SESSION_MEMORY_LIMIT));

      res.json({
        reply,
        source: "openai",
        model: completion.model ?? DEFAULT_MODEL,
        sessionId,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(502).json({
        error: details,
        reply: DEFAULT_CHAT_ERROR,
      });
    }
  });

  try {
    await registerLinkedinDiagnosticsRoutes(app);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error(`[linkedin-diagnostic] Rotas desativadas: ${details}`);
  }

  try {
    await registerLinkedinOAuthRoutes(app);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error(`[linkedin-oauth] Rotas desativadas: ${details}`);
  }

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
