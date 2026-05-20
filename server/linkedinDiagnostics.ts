import { type Express } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { PDFParse } from "pdf-parse";
import { Pool } from "pg";

type Criticality = "alta" | "media" | "baixa";

type Opportunity = {
  title: string;
  impact: string;
  reason: string;
};

type AreaScore = {
  area: string;
  score: number;
  justification: string;
};

type DiagnosticAnalysis = {
  score: number;
  criticality: Criticality;
  summary: string;
  areaScores: AreaScore[];
  opportunities: Opportunity[];
  methodologyImprovements: string[];
};

type CheckoutRequestBody = {
  email?: string;
  name?: string;
  authMethod?: "google" | "manual";
  acceptTerms?: boolean;
};

type PixProvider = "mock" | "mercadopago";

type PixChargeResult = {
  provider: PixProvider;
  status: "pending" | "paid";
  pixCode: string;
  pixQrData: string;
  paymentReference: string;
  providerPaymentId?: string;
};

type DiagnosticRequestBody = {
  linkedinUrl?: string;
  visitorId?: string;
};

const DEFAULT_DIAGNOSTIC_MODEL = process.env.OPENAI_DIAGNOSTIC_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const REPORT_PRICE_CENTS = Number.parseInt(process.env.LINKEDIN_REPORT_PRICE_CENTS ?? "19900", 10);
const PIX_PROVIDER: PixProvider =
  process.env.PIX_PROVIDER?.trim().toLowerCase() === "mercadopago" ? "mercadopago" : "mock";

let dbPool: Pool | null = null;
let dbReady = false;

const profilePdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function getDbPool(): Pool {
  if (dbPool) {
    return dbPool;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const sslDisabled = process.env.DATABASE_SSL === "false";

  dbPool = new Pool({
    connectionString: databaseUrl,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: 10,
  });

  return dbPool;
}

async function ensureSchema() {
  if (dbReady) {
    return;
  }

  const pool = getDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS linkedin_diagnostics (
      id TEXT PRIMARY KEY,
      linkedin_url TEXT NOT NULL,
      normalized_linkedin_url TEXT NOT NULL,
      profile_snapshot TEXT,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      criticality TEXT NOT NULL,
      summary TEXT NOT NULL,
      opportunities JSONB NOT NULL,
      raw_analysis JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      visitor_id TEXT,
      user_id TEXT REFERENCES app_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_linkedin_diagnostics_created_at ON linkedin_diagnostics(created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_linkedin_diagnostics_user_id ON linkedin_diagnostics(user_id)
  `);

  await pool.query(`
    ALTER TABLE linkedin_diagnostics
    ADD COLUMN IF NOT EXISTS profile_snapshot TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS funnel_events (
      id BIGSERIAL PRIMARY KEY,
      diagnostic_id TEXT REFERENCES linkedin_diagnostics(id) ON DELETE CASCADE,
      event_name TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkout_orders (
      id TEXT PRIMARY KEY,
      diagnostic_id TEXT NOT NULL REFERENCES linkedin_diagnostics(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES app_users(id),
      email TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      payment_method TEXT NOT NULL DEFAULT 'pix',
      status TEXT NOT NULL DEFAULT 'pending',
      pix_code TEXT,
      pix_qr_data TEXT,
      payment_reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_checkout_orders_diagnostic_id ON checkout_orders(diagnostic_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_checkout_orders_status ON checkout_orders(status)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      diagnostic_id TEXT NOT NULL UNIQUE REFERENCES linkedin_diagnostics(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES app_users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unlocked_at TIMESTAMPTZ
    )
  `);

  dbReady = true;
}

function normalizeLinkedinUrl(rawValue?: string): string | null {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.toLowerCase();

    if (!hostname.endsWith("linkedin.com")) {
      return null;
    }

    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    if (!cleanPath || !cleanPath.startsWith("/in/")) {
      return null;
    }

    return `https://www.linkedin.com${cleanPath}`;
  } catch {
    return null;
  }
}

function extractFirstMatch(source: string, pattern: RegExp): string | null {
  const match = source.match(pattern);
  if (!match || typeof match[1] !== "string") {
    return null;
  }

  const normalized = match[1]
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  return normalized || null;
}

async function fetchLinkedinProfileSnapshot(linkedinUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(linkedinUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();

    // LinkedIn often redirects non-authenticated requests to authwall.
    // In this case we cannot reliably read section details even for profiles
    // that appear public in a normal browser session.
    if (/\/authwall/i.test(html) || /sessionRedirect=/i.test(html)) {
      return "SINAL_TECNICO: LinkedIn authwall detectado. Conteúdo detalhado do perfil bloqueado para coleta automática sem sessão autenticada.";
    }

    const title = extractFirstMatch(html, /<title>([^<]+)<\/title>/i);
    const metaDescription =
      extractFirstMatch(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ??
      extractFirstMatch(html, /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    const ogTitle =
      extractFirstMatch(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ??
      extractFirstMatch(html, /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
    const ogDescription =
      extractFirstMatch(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ??
      extractFirstMatch(html, /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);

    const topCardHeadline = extractFirstMatch(
      html,
      /class=["'][^"']*top-card-layout__headline[^"']*["'][^>]*>([^<]{4,240})</i,
    );

    const topCardSubline = extractFirstMatch(
      html,
      /class=["'][^"']*top-card-layout__first-subline[^"']*["'][^>]*>([^<]{4,240})</i,
    );

    const lines = [
      title ? `Title: ${title}` : "",
      ogTitle ? `OG Title: ${ogTitle}` : "",
      topCardHeadline ? `Headline: ${topCardHeadline}` : "",
      topCardSubline ? `Subline: ${topCardSubline}` : "",
      metaDescription ? `Description: ${metaDescription}` : "",
      ogDescription ? `OG Description: ${ogDescription}` : "",
    ].filter((item) => item.length > 0);

    if (lines.length === 0) {
      return undefined;
    }

    return Array.from(new Set(lines)).join("\n");
  } catch {
    return undefined;
  }
}

function cleanupSnapshotText(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

async function extractPdfTextWithOpenAIVision(pageImages: string[]): Promise<string | undefined> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || pageImages.length === 0) {
    return undefined;
  }

  const model = DEFAULT_DIAGNOSTIC_MODEL;
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    {
      type: "text",
      text:
        "Extraia somente texto útil de currículo/perfil LinkedIn presente nas imagens. " +
        "Retorne texto limpo com campos como nome, headline, sobre, experiencias, formacao, habilidades e recomendacoes, sem inventar.",
    },
    ...pageImages.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_completion_tokens: 1800,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    }),
    signal: AbortSignal.timeout(50000),
  });

  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const raw = data.choices?.[0]?.message?.content?.trim();
  return raw ? cleanupSnapshotText(raw).slice(0, 14000) : undefined;
}

async function extractTextFromProfilePdf(fileBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const parsed = await parser.getText({
      parseHyperlinks: true,
      lineEnforce: true,
      pageJoiner: "\n-- pagina page_number de total_number --\n",
    });

    let text = cleanupSnapshotText(parsed.text ?? "");

    if (text.length < 80) {
      const info = await parser.getInfo({ parsePageInfo: true }).catch(() => null);
      const infoText = cleanupSnapshotText(
        [
          info?.info?.Title ? `Titulo: ${String(info.info.Title)}` : "",
          info?.info?.Author ? `Autor: ${String(info.info.Author)}` : "",
          ...(info?.pages ?? [])
            .flatMap((page) => page.links ?? [])
            .map((link) => `${link.text || "link"}: ${link.url || ""}`),
        ]
          .filter((item) => item.length > 0)
          .join("\n"),
      );

      if (infoText) {
        text = cleanupSnapshotText(`${text}\n${infoText}`);
      }
    }

    if (text.length < 80) {
      const screenshots = await parser
        .getScreenshot({ first: 2, desiredWidth: 1400, imageDataUrl: true, imageBuffer: false })
        .catch(() => null);
      const images = screenshots?.pages?.map((page) => page.dataUrl).filter((value) => !!value) ?? [];
      const visionText = await extractPdfTextWithOpenAIVision(images);
      if (visionText) {
        text = cleanupSnapshotText(`${text}\n${visionText}`);
      }
    }

    if (!text || text.length < 30) {
      throw new Error("Não foi possível extrair texto legível do PDF exportado.");
    }

    return text.slice(0, 14000);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function extractLinkedinUrlFromText(pdfText: string): string | null {
  const match = pdfText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?/i);
  if (!match) {
    return null;
  }

  return normalizeLinkedinUrl(match[0]);
}

function buildDiagnosticPrompt(linkedinUrl: string, profileSnapshot?: string): string {
  const hasSnapshot = !!profileSnapshot?.trim();

  return [
    "Você é um consultor sênior de branding profissional e otimização de perfis LinkedIn da Taktia.",
    "Objetivo: gerar um diagnóstico inicial técnico, consistente e explicável.",
    "",
    `URL recebida: ${linkedinUrl}`,
    hasSnapshot ? "Trechos reais do perfil (coletados automaticamente da URL):" : "ATENÇÃO: sem trechos públicos suficientes na URL, trate como leitura preliminar de menor precisão.",
    hasSnapshot ? profileSnapshot!.trim().slice(0, 8000) : "",
    "",
    "Instruções obrigatórias:",
    "1) Seja objetivo e orientado a evidências.",
    "2) Avalie potencial de atratividade, autoridade e conversão comercial/profissional.",
    "3) Retorne score entre 0 e 100.",
    "4) Defina criticidade como: alta, media ou baixa.",
    "5) Retorne areaScores com EXATAMENTE 7 áreas: Headline, Sobre, Experiencias, Formacao, Habilidades, Recomendacoes, FotoBanner.",
    "6) Cada item de areaScores deve conter:",
    "   - area: nome da área",
    "   - score: nota de 0 a 100 para a área",
    "   - justification: justificativa objetiva da nota (sem ação recomendada)",
    "7) Liste de 3 a 5 oportunidades prioritárias APENAS como achados, sem passo a passo.",
    "8) Cada oportunidade deve ter:",
    "   - title: nome curto do achado",
    "   - impact: impacto esperado em linguagem de negócio",
    "   - reason: por que este ponto tende a reduzir resultados",
    "9) O summary deve ter no máximo 320 caracteres.",
    "10) Retorne methodologyImprovements com 3 a 5 bullets explicando como melhorar a própria avaliação em execuções futuras.",
    "11) Não use jargões vagos e não invente dados pessoais específicos.",
    "12) Se houver incerteza por limitação de dados públicos, explicite de forma breve no summary e nas justificativas.",
    "13) Diagnóstico preliminar NÃO deve conter ações práticas nem textos prontos de substituição.",
    "14) Se houver sinal de authwall/bloqueio técnico do LinkedIn, deixe isso claro e NÃO penalize agressivamente por ausência de dados não acessíveis.",
  ].join("\n");
}

function fallbackDiagnostic(linkedinUrl: string): DiagnosticAnalysis {
  const stableSeed = linkedinUrl.length % 12;
  const score = Math.max(42, Math.min(78, 54 + stableSeed));

  return {
    score,
    criticality: score < 55 ? "alta" : score < 70 ? "media" : "baixa",
    summary:
      "Diagnóstico inicial gerado com base em sinais públicos limitados. Ajustes em headline, proposta de valor e narrativa de experiência tendem a elevar atratividade e conversão.",
    areaScores: [
      {
        area: "Headline",
        score: Math.max(35, score - 8),
        justification: "Título tende a não explicitar nicho, proposta de valor e diferencial competitivo em poucos segundos.",
      },
      {
        area: "Sobre",
        score: Math.max(35, score - 6),
        justification: "Resumo tende a carecer de narrativa de problema, método e prova objetiva de resultado.",
      },
      {
        area: "Experiencias",
        score: Math.max(35, score - 5),
        justification: "Experiências geralmente não destacam indicadores claros de impacto e contexto de entrega.",
      },
      {
        area: "Formacao",
        score: Math.max(45, score - 2),
        justification: "Formação costuma estar descrita, mas nem sempre conectada ao posicionamento atual.",
      },
      {
        area: "Habilidades",
        score: Math.max(35, score - 7),
        justification: "Stack de habilidades tende a ser genérica e sem priorização aderente ao objetivo profissional.",
      },
      {
        area: "Recomendacoes",
        score: Math.max(30, score - 10),
        justification: "Ausência ou baixa densidade de recomendações reduz validação social do perfil.",
      },
      {
        area: "FotoBanner",
        score: Math.max(45, score - 1),
        justification: "Elementos visuais podem estar funcionais, mas sem reforço claro de posicionamento.",
      },
    ],
    opportunities: [
      {
        title: "Headline orientada a resultado",
        impact: "Aumenta a clareza de posicionamento em poucos segundos.",
        reason: "Headlines genéricas reduzem autoridade e diferenciação.",
      },
      {
        title: "Seção Sobre com prova de valor",
        impact: "Melhora confiança e taxa de resposta em contatos.",
        reason: "Sem contexto de problema e resultado, o perfil perde força comercial.",
      },
      {
        title: "Experiências com métricas",
        impact: "Eleva percepção de competência e senioridade.",
        reason: "Descrições sem indicadores não comprovam impacto real.",
      },
    ],
    methodologyImprovements: [
      "Incluir capturas textuais de Headline, Sobre e 2 experiências para reduzir inferência.",
      "Definir objetivo principal do perfil (emprego, consultoria, vendas) antes da avaliação.",
      "Padronizar o mesmo rubric por área para comparar execuções ao longo do tempo.",
    ],
  };
}

function sanitizeAnalysis(candidate: unknown, linkedinUrl: string): DiagnosticAnalysis {
  if (!candidate || typeof candidate !== "object") {
    return fallbackDiagnostic(linkedinUrl);
  }

  const raw = candidate as Record<string, unknown>;
  const score = typeof raw.score === "number" ? Math.round(raw.score) : NaN;
  const criticality = raw.criticality;
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const areaScores = Array.isArray(raw.areaScores) ? raw.areaScores : [];
  const opportunities = Array.isArray(raw.opportunities) ? raw.opportunities : [];
  const methodologyImprovements = Array.isArray(raw.methodologyImprovements) ? raw.methodologyImprovements : [];

  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return fallbackDiagnostic(linkedinUrl);
  }

  if (criticality !== "alta" && criticality !== "media" && criticality !== "baixa") {
    return fallbackDiagnostic(linkedinUrl);
  }

  if (!summary) {
    return fallbackDiagnostic(linkedinUrl);
  }

  const normalizedAreaScores = areaScores
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const obj = item as Record<string, unknown>;
      const area = typeof obj.area === "string" ? obj.area.trim() : "";
      const areaScore = typeof obj.score === "number" ? Math.round(obj.score) : NaN;
      const justification = typeof obj.justification === "string" ? obj.justification.trim() : "";

      if (!area || !Number.isFinite(areaScore) || areaScore < 0 || areaScore > 100 || !justification) {
        return null;
      }

      return { area, score: areaScore, justification } as AreaScore;
    })
    .filter((value): value is AreaScore => value !== null)
    .slice(0, 7);

  const normalizedOpportunities = opportunities
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const obj = item as Record<string, unknown>;
      const title = typeof obj.title === "string" ? obj.title.trim() : "";
      const impact = typeof obj.impact === "string" ? obj.impact.trim() : "";
      const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";

      if (!title || !impact || !reason) {
        return null;
      }

      return { title, impact, reason } as Opportunity;
    })
    .filter((value): value is Opportunity => value !== null)
    .slice(0, 5);

  const normalizedMethodologyImprovements = methodologyImprovements
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((value) => value.length > 0)
    .slice(0, 5);

  if (normalizedAreaScores.length < 5 || normalizedOpportunities.length === 0 || normalizedMethodologyImprovements.length === 0) {
    return fallbackDiagnostic(linkedinUrl);
  }

  return {
    score,
    criticality,
    summary,
    areaScores: normalizedAreaScores,
    opportunities: normalizedOpportunities,
    methodologyImprovements: normalizedMethodologyImprovements,
  };
}

async function generateDiagnosticWithOpenAI(linkedinUrl: string, profileSnapshot?: string): Promise<DiagnosticAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return fallbackDiagnostic(linkedinUrl);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_DIAGNOSTIC_MODEL,
      temperature: 0.25,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "linkedin_diagnostic",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["score", "criticality", "summary", "areaScores", "opportunities", "methodologyImprovements"],
            properties: {
              score: { type: "number" },
              criticality: { type: "string", enum: ["alta", "media", "baixa"] },
              summary: { type: "string" },
              areaScores: {
                type: "array",
                minItems: 7,
                maxItems: 7,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["area", "score", "justification"],
                  properties: {
                    area: { type: "string" },
                    score: { type: "number" },
                    justification: { type: "string" },
                  },
                },
              },
              opportunities: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "impact", "reason"],
                  properties: {
                    title: { type: "string" },
                    impact: { type: "string" },
                    reason: { type: "string" },
                  },
                },
              },
              methodologyImprovements: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: { type: "string" },
              },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: buildDiagnosticPrompt(linkedinUrl, profileSnapshot),
        },
        {
          role: "user",
          content:
            "Gere o diagnóstico inicial conforme instruções e retorne apenas JSON válido. Lembre: preliminar sem ações práticas.",
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    return fallbackDiagnostic(linkedinUrl);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return fallbackDiagnostic(linkedinUrl);
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    return sanitizeAnalysis(parsed, linkedinUrl);
  } catch {
    return fallbackDiagnostic(linkedinUrl);
  }
}

function buildPixPayload(reference: string, amountInCents: number): { pixCode: string; pixQrData: string } {
  const amount = (amountInCents / 100).toFixed(2);
  const pixCode = `PIX|Taktia|${reference}|${amount}`;
  return {
    pixCode,
    pixQrData: `pix://taktia.com.br/pay/${reference}`,
  };
}

function getMercadoPagoAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurada.");
  }
  return token;
}

async function createMercadoPagoPixCharge(input: {
  checkoutId: string;
  amountCents: number;
  email: string;
  fullName?: string;
}): Promise<PixChargeResult> {
  const accessToken = getMercadoPagoAccessToken();
  const baseUrl = "https://api.mercadopago.com";
  const amount = Number((input.amountCents / 100).toFixed(2));

  const notificationUrl = process.env.PIX_NOTIFICATION_URL?.trim();
  const statementDescriptor = process.env.PIX_STATEMENT_DESCRIPTOR?.trim();

  const payload: Record<string, unknown> = {
    transaction_amount: amount,
    description: "Relatório LinkedIn Taktia",
    payment_method_id: "pix",
    external_reference: input.checkoutId,
    payer: {
      email: input.email,
      first_name: input.fullName?.trim() || "Cliente",
    },
  };

  if (notificationUrl) {
    payload.notification_url = notificationUrl;
  }

  if (statementDescriptor) {
    payload.statement_descriptor = statementDescriptor;
  }

  const response = await fetch(`${baseUrl}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": input.checkoutId,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Falha ao criar Pix no Mercado Pago (${response.status}): ${details || "sem detalhes"}`);
  }

  const data = (await response.json()) as {
    id?: number | string;
    status?: string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
      };
    };
  };

  const paymentReference = String(data.id ?? input.checkoutId);
  const pixCode = data.point_of_interaction?.transaction_data?.qr_code;
  const pixQrData = data.point_of_interaction?.transaction_data?.qr_code_base64;

  if (!pixCode || !pixQrData) {
    throw new Error("Mercado Pago não retornou dados do QR Code Pix.");
  }

  return {
    provider: "mercadopago",
    status: data.status === "approved" ? "paid" : "pending",
    pixCode,
    pixQrData,
    paymentReference,
    providerPaymentId: paymentReference,
  };
}

async function createPixCharge(input: {
  checkoutId: string;
  amountCents: number;
  email: string;
  fullName?: string;
}): Promise<PixChargeResult> {
  if (PIX_PROVIDER === "mercadopago") {
    return createMercadoPagoPixCharge(input);
  }

  const payload = buildPixPayload(input.checkoutId, input.amountCents);
  return {
    provider: "mock",
    status: "pending",
    pixCode: payload.pixCode,
    pixQrData: payload.pixQrData,
    paymentReference: input.checkoutId,
  };
}

async function getMercadoPagoPayment(paymentId: string) {
  const accessToken = getMercadoPagoAccessToken();
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Falha ao consultar pagamento Mercado Pago (${response.status}): ${details || "sem detalhes"}`);
  }

  return (await response.json()) as {
    id?: number | string;
    status?: string;
    external_reference?: string;
  };
}

function buildLockedReportPreview(analysis: DiagnosticAnalysis): string {
  return [
    "Relatório LinkedIn Taktia",
    "",
    `Score inicial: ${analysis.score}`,
    `Criticidade: ${analysis.criticality}`,
    "",
    "Resumo:",
    analysis.summary,
    "",
    "Notas por área (preliminar):",
    ...analysis.areaScores.map((item) => `- ${item.area}: ${item.score}/100 — ${item.justification}`),
    "",
    "Ao confirmar o pagamento, o relatório completo será liberado nesta área com plano de ação detalhado.",
  ].join("\n");
}

async function unlockCheckoutAndReport(checkoutId: string) {
  const pool = getDbPool();
  const checkout = await pool.query<{ diagnostic_id: string; status: string; user_id: string | null }>(
    `SELECT diagnostic_id, status, user_id FROM checkout_orders WHERE id = $1`,
    [checkoutId],
  );

  if (checkout.rowCount === 0) {
    return { found: false as const, paid: false as const };
  }

  const row = checkout.rows[0];
  if (row.status === "paid") {
    return { found: true as const, paid: true as const, diagnosticId: row.diagnostic_id };
  }

  await pool.query(`UPDATE checkout_orders SET status = 'paid', paid_at = NOW() WHERE id = $1`, [checkoutId]);

  const diagRow = await pool.query<{ normalized_linkedin_url: string; profile_snapshot: string | null; raw_analysis: unknown }>(
    `SELECT normalized_linkedin_url, profile_snapshot, raw_analysis FROM linkedin_diagnostics WHERE id = $1`,
    [row.diagnostic_id],
  );

  let fullContent: string | null = null;
  if (diagRow.rowCount && diagRow.rowCount > 0) {
    const d = diagRow.rows[0];
    const analysis = sanitizeAnalysis(d.raw_analysis, d.normalized_linkedin_url);
    fullContent = await generateFullReportContent(d.normalized_linkedin_url, analysis, d.profile_snapshot ?? undefined).catch(
      () => null,
    );
  }

  await pool.query(
    `UPDATE reports
     SET status = 'unlocked', unlocked_at = NOW(),
         user_id = COALESCE(user_id, $2)
         ${fullContent ? ", content = $3" : ""}
     WHERE diagnostic_id = $1`,
    fullContent ? [row.diagnostic_id, row.user_id, fullContent] : [row.diagnostic_id, row.user_id],
  );

  await trackEvent(row.diagnostic_id, "payment_confirmed", { checkoutId });

  return { found: true as const, paid: true as const, diagnosticId: row.diagnostic_id };
}

function buildAreaScoresForReport(areaScores: AreaScore[]): string {
  return areaScores
    .map((item, index) => {
      return `${index + 1}. ${item.area}\n   Nota: ${item.score}/100\n   Justificativa: ${item.justification}`;
    })
    .join("\n\n");
}

function buildFullReportPrompt(linkedinUrl: string, analysis: DiagnosticAnalysis, profileSnapshot?: string): string {
  const findings = analysis.opportunities
    .map((o, i) => `${i + 1}. ${o.title}\n   Impacto: ${o.impact}\n   Motivo: ${o.reason}`)
    .join("\n\n");

  const areaScores = buildAreaScoresForReport(analysis.areaScores);
  const methodology = analysis.methodologyImprovements.map((item) => `- ${item}`).join("\n");
  const hasSnapshot = !!profileSnapshot?.trim();

  return [
    "Você é um consultor sênior de branding e otimização de perfis LinkedIn da Taktia.",
    "Um profissional pagou pelo relatório completo de diagnóstico do seu perfil LinkedIn.",
    "Gere um relatório profissional, detalhado e altamente específico, em português do Brasil.",
    "",
    `URL do perfil: ${linkedinUrl}`,
    `Score inicial: ${analysis.score}/100`,
    `Criticidade: ${analysis.criticality}`,
    `Resumo diagnóstico: ${analysis.summary}`,
    "",
    "Notas e justificativas por área do diagnóstico preliminar:",
    areaScores,
    "",
    "Achados prioritários:",
    findings,
    "",
    "Direções de melhoria da metodologia já identificadas:",
    methodology,
    "",
    hasSnapshot ? "Trechos reais fornecidos do perfil (fonte primária para substituições):" : "",
    hasSnapshot ? profileSnapshot!.trim().slice(0, 8000) : "",
    "",
    "Estrutura obrigatória do relatório completo (em Markdown):",
    "# Relatório LinkedIn Taktia",
    "## Diagnóstico Consolidado",
    "- Sintetize as notas por área e explique prioridades",
    "## Ajustes Específicos por Área",
    "- Para cada área, inclua sugestões de troca textual no formato: 'onde está: ...' / 'prefira: ...'",
    "- Quando houver trecho real fornecido, cite literalmente no campo 'onde está'.",
    "- Sempre que não houver trecho original confiável, marque explicitamente: 'trecho original não confirmado publicamente'",
    "## Plano de Ação Priorizado e Personalizado",
    "- Ações específicas por impacto, evitando orientações genéricas",
    "## Tabela de Substituições Prontas",
    "- Monte uma tabela com colunas: Área | Trecho atual | Sugestão de substituição | Objetivo da troca",
    "## Como Melhorar a Próxima Avaliação",
    "- Explique que dados enviar (headline atual, sobre atual, experiências-chave etc.)",
    "- Defina um rubric enxuto para manter direção consistente e ajustar ao perfil",
    "## Próximos Passos",
    "- Cronograma em imediato, 7 dias e 30 dias",
    "",
    "Regras:",
    "- Não entregue recomendações vagas.",
    "- Não invente dados pessoais não confirmados.",
    "- Quando faltar contexto do texto real do perfil, deixe isso explícito e ofereça alternativas prontas de preenchimento.",
    "- O relatório deve ser acionável e permitir copiar/colar sugestões com mínimo esforço.",
  ].join("\n");
}

async function generateFullReportContent(
  linkedinUrl: string,
  analysis: DiagnosticAnalysis,
  profileSnapshot?: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return buildLockedReportPreview(analysis);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_DIAGNOSTIC_MODEL,
      temperature: 0.3,
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: buildFullReportPrompt(linkedinUrl, analysis, profileSnapshot) },
        { role: "user", content: "Gere o relatório completo agora." },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(`[generateFullReportContent] OpenAI error ${response.status}: ${errBody}`);
    return buildLockedReportPreview(analysis);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? buildLockedReportPreview(analysis);
}

function buildReportHtml(title: string, content: string, linkedinUrl: string, score: number, criticality: string, generatedAt: string): string {
  const rows = content
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("- ") || line.startsWith("* ")) return `<li>${line.slice(2)}</li>`;
      if (/^\d+\.\s/.test(line)) return `<li>${line.replace(/^\d+\.\s/, "")}</li>`;
      if (line.trim() === "") return "<br>";
      return `<p>${line}</p>`;
    })
    .join("\n");

  const critColor = criticality === "alta" ? "#ef4444" : criticality === "media" ? "#f59e0b" : "#10b981";
  const scoreColor = score < 55 ? "#ef4444" : score < 70 ? "#f59e0b" : "#10b981";
  const date = new Date(generatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Taktia</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Sans:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.7; }
    .wrapper { max-width: 820px; margin: 0 auto; padding: 48px 32px; }
    header { border-bottom: 3px solid #0ea5e9; padding-bottom: 24px; margin-bottom: 32px; }
    .brand { font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #0ea5e9; text-transform: uppercase; margin-bottom: 12px; }
    header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; color: #0f172a; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 16px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; border: 1px solid currentColor; }
    .score-badge { color: ${scoreColor}; background: ${scoreColor}15; }
    .crit-badge { color: ${critColor}; background: ${critColor}15; }
    .url-badge { color: #64748b; background: #f1f5f9; border-color: #cbd5e1; font-weight: 400; word-break: break-all; }
    .date { font-size: 12px; color: #94a3b8; margin-top: 8px; }
    .content { margin-top: 8px; }
    h1 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: #0f172a; margin: 32px 0 12px; border-left: 4px solid #0ea5e9; padding-left: 12px; }
    h2 { font-family: 'Space Grotesk', sans-serif; font-size: 17px; color: #0f172a; margin: 24px 0 8px; }
    h3 { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: #334155; margin: 16px 0 6px; }
    p { margin-bottom: 8px; color: #334155; }
    li { margin: 4px 0 4px 20px; color: #334155; }
    li::marker { color: #0ea5e9; }
    br { display: block; margin: 4px 0; }
    footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print { body { background: white; } .wrapper { padding: 24px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <div class="brand">Taktia Automações</div>
      <h1>${title}</h1>
      <div class="meta">
        <span class="badge score-badge">Score ${score}/100</span>
        <span class="badge crit-badge">Criticidade ${criticality}</span>
        <span class="badge url-badge">${linkedinUrl}</span>
      </div>
      <div class="date">Gerado em ${date}</div>
    </header>
    <div class="content">${rows}</div>
    <footer>Este relatório foi gerado automaticamente pela Taktia Automações · taktia.com.br</footer>
  </div>
</body>
</html>`;
}

async function trackEvent(diagnosticId: string, eventName: string, metadata: Record<string, unknown> = {}) {
  const pool = getDbPool();
  await pool.query(
    `INSERT INTO funnel_events (diagnostic_id, event_name, metadata)
     VALUES ($1, $2, $3::jsonb)`,
    [diagnosticId, eventName, JSON.stringify(metadata)],
  );
}

export async function registerLinkedinDiagnosticsRoutes(app: Express) {
  await ensureSchema();

  app.post("/api/linkedin-diagnostic/from-pdf", profilePdfUpload.single("profilePdf"), async (req, res) => {
    const linkedinUrlRaw = typeof req.body?.linkedinUrl === "string" ? req.body.linkedinUrl : "";
    const visitorIdRaw = typeof req.body?.visitorId === "string" ? req.body.visitorId : "";

    if (!req.file?.buffer) {
      res.status(400).json({ error: "Envie o PDF exportado do perfil para continuar." });
      return;
    }

    try {
      const pdfText = await extractTextFromProfilePdf(req.file.buffer);
      const normalizedFromBody = normalizeLinkedinUrl(linkedinUrlRaw);
      const normalizedFromPdf = extractLinkedinUrlFromText(pdfText);
      const normalizedUrl = normalizedFromBody ?? normalizedFromPdf;

      if (!normalizedUrl) {
        res.status(400).json({
          error:
            "Não foi possível identificar a URL do perfil no PDF. Informe também a URL do LinkedIn (formato /in/...).",
        });
        return;
      }

      const analysis = await generateDiagnosticWithOpenAI(normalizedUrl, pdfText);
      const pool = getDbPool();
      const diagnosticId = `diag_${nanoid(14)}`;

      await pool.query(
        `INSERT INTO linkedin_diagnostics
          (id, linkedin_url, normalized_linkedin_url, profile_snapshot, score, criticality, summary, opportunities, raw_analysis, visitor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
        [
          diagnosticId,
          linkedinUrlRaw.trim() || normalizedUrl,
          normalizedUrl,
          pdfText,
          analysis.score,
          analysis.criticality,
          analysis.summary,
          JSON.stringify(analysis.opportunities),
          JSON.stringify(analysis),
          visitorIdRaw.trim() || null,
        ],
      );

      await pool.query(
        `INSERT INTO reports (id, diagnostic_id, title, content, status)
         VALUES ($1, $2, $3, $4, 'locked')`,
        [`rep_${nanoid(14)}`, diagnosticId, "Relatório LinkedIn Taktia", buildLockedReportPreview(analysis)],
      );

      await trackEvent(diagnosticId, "diagnostic_created", {
        source: "pdf_upload",
      });

      res.json({
        diagnosticId,
        score: analysis.score,
        criticality: analysis.criticality,
        summary: analysis.summary,
        areaScores: analysis.areaScores,
        opportunities: analysis.opportunities,
        methodologyImprovements: analysis.methodologyImprovements,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao processar PDF do LinkedIn: ${details}` });
    }
  });

  app.post("/api/linkedin-diagnostic", async (req, res) => {
    const body = (req.body ?? {}) as DiagnosticRequestBody;
    const normalizedUrl = normalizeLinkedinUrl(body.linkedinUrl);

    if (!normalizedUrl) {
      res.status(400).json({ error: "Informe uma URL válida de perfil LinkedIn (formato /in/...)." });
      return;
    }

    try {
      const profileSnapshot = await fetchLinkedinProfileSnapshot(normalizedUrl);
      const analysis = await generateDiagnosticWithOpenAI(normalizedUrl, profileSnapshot);
      const pool = getDbPool();
      const diagnosticId = `diag_${nanoid(14)}`;

      await pool.query(
        `INSERT INTO linkedin_diagnostics
          (id, linkedin_url, normalized_linkedin_url, profile_snapshot, score, criticality, summary, opportunities, raw_analysis, visitor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
        [
          diagnosticId,
          body.linkedinUrl?.trim() ?? normalizedUrl,
          normalizedUrl,
          profileSnapshot || null,
          analysis.score,
          analysis.criticality,
          analysis.summary,
          JSON.stringify(analysis.opportunities),
          JSON.stringify(analysis),
          body.visitorId?.trim() || null,
        ],
      );

      await pool.query(
        `INSERT INTO reports (id, diagnostic_id, title, content, status)
         VALUES ($1, $2, $3, $4, 'locked')`,
        [`rep_${nanoid(14)}`, diagnosticId, "Relatório LinkedIn Taktia", buildLockedReportPreview(analysis)],
      );

      await trackEvent(diagnosticId, "diagnostic_created", {
        source: "public_page",
      });

      res.json({
        diagnosticId,
        score: analysis.score,
        criticality: analysis.criticality,
        summary: analysis.summary,
        areaScores: analysis.areaScores,
        opportunities: analysis.opportunities,
        methodologyImprovements: analysis.methodologyImprovements,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao gerar diagnóstico: ${details}` });
    }
  });

  app.post("/api/linkedin-diagnostic/:diagnosticId/checkout", async (req, res) => {
    const { diagnosticId } = req.params;
    const body = (req.body ?? {}) as CheckoutRequestBody;
    const email = body.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Informe um e-mail válido para vincular a compra." });
      return;
    }

    if (!body.acceptTerms) {
      res.status(400).json({ error: "É necessário aceitar os termos e a política de privacidade." });
      return;
    }

    try {
      const pool = getDbPool();
      const diagnosticRow = await pool.query<{ id: string }>(
        `SELECT id FROM linkedin_diagnostics WHERE id = $1`,
        [diagnosticId],
      );

      if (diagnosticRow.rowCount === 0) {
        res.status(404).json({ error: "Diagnóstico não encontrado." });
        return;
      }

      const userId = `usr_${nanoid(12)}`;
      await pool.query(
        `INSERT INTO app_users (id, email, full_name, auth_provider)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email)
         DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, app_users.full_name),
                       auth_provider = EXCLUDED.auth_provider,
                       updated_at = NOW()`,
        [userId, email, body.name?.trim() || null, body.authMethod ?? "manual"],
      );

      const linkedUser = await pool.query<{ id: string }>(`SELECT id FROM app_users WHERE email = $1`, [email]);
      const finalUserId = linkedUser.rows[0]?.id;

      await pool.query(`UPDATE linkedin_diagnostics SET user_id = $2 WHERE id = $1`, [diagnosticId, finalUserId ?? null]);

      const checkoutId = `chk_${nanoid(14)}`;
      const pixCharge = await createPixCharge({
        checkoutId,
        amountCents: REPORT_PRICE_CENTS,
        email,
        fullName: body.name,
      });

      await pool.query(
        `INSERT INTO checkout_orders
          (id, diagnostic_id, user_id, email, amount_cents, payment_method, status, pix_code, pix_qr_data, payment_reference)
         VALUES ($1, $2, $3, $4, $5, 'pix', 'pending', $6, $7, $8)`,
        [
          checkoutId,
          diagnosticId,
          finalUserId ?? null,
          email,
          REPORT_PRICE_CENTS,
          pixCharge.pixCode,
          pixCharge.pixQrData,
          pixCharge.providerPaymentId ?? pixCharge.paymentReference,
        ],
      );

      if (pixCharge.status === "paid") {
        await unlockCheckoutAndReport(checkoutId);
      }

      await trackEvent(diagnosticId, "checkout_created", {
        checkoutId,
        paymentMethod: "pix",
      });

      res.json({
        checkoutId,
        status: pixCharge.status,
        amountCents: REPORT_PRICE_CENTS,
        currency: "BRL",
        paymentMethod: "pix",
        provider: pixCharge.provider,
        pixCode: pixCharge.pixCode,
        pixQrData: pixCharge.pixQrData,
        paymentReference: pixCharge.paymentReference,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao criar checkout: ${details}` });
    }
  });

  app.get("/api/checkout/:checkoutId/status", async (req, res) => {
    const { checkoutId } = req.params;

    try {
      const pool = getDbPool();
      const result = await pool.query<{
        id: string;
        status: string;
        paid_at: string | null;
      }>(
        `SELECT id, status, paid_at
         FROM checkout_orders
         WHERE id = $1`,
        [checkoutId],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Checkout não encontrado." });
        return;
      }

      res.json(result.rows[0]);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao consultar checkout: ${details}` });
    }
  });

  app.post("/api/payments/pix/webhook/mercadopago", async (req, res) => {
    try {
      if (PIX_PROVIDER !== "mercadopago") {
        res.status(204).end();
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const data = (body.data ?? {}) as Record<string, unknown>;

      const paymentId =
        (typeof data.id === "string" && data.id) ||
        (typeof data.id === "number" && String(data.id)) ||
        (typeof req.query["data.id"] === "string" ? req.query["data.id"] : "") ||
        (typeof req.query.id === "string" ? req.query.id : "");

      if (!paymentId) {
        res.status(400).json({ error: "Pagamento não identificado no webhook." });
        return;
      }

      const payment = await getMercadoPagoPayment(paymentId);
      const checkoutId = payment.external_reference?.trim();

      if (!checkoutId) {
        res.status(202).json({ received: true, ignored: "external_reference ausente" });
        return;
      }

      if (payment.status !== "approved") {
        res.status(202).json({ received: true, status: payment.status ?? "unknown" });
        return;
      }

      const unlocked = await unlockCheckoutAndReport(checkoutId);
      if (!unlocked.found) {
        res.status(404).json({ error: "Checkout não encontrado para o pagamento informado." });
        return;
      }

      res.status(200).json({ received: true, checkoutId, status: "paid" });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao processar webhook Pix: ${details}` });
    }
  });

  app.post("/api/checkout/:checkoutId/confirm-payment", async (req, res) => {
    const { checkoutId } = req.params;

    try {
      const unlocked = await unlockCheckoutAndReport(checkoutId);
      if (!unlocked.found) {
        res.status(404).json({ error: "Checkout não encontrado." });
        return;
      }

      res.json({ success: true, status: "paid" });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao confirmar pagamento: ${details}` });
    }
  });

  app.get("/api/my/reports", async (req, res) => {
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Informe um e-mail válido para listar relatórios." });
      return;
    }

    try {
      const pool = getDbPool();
      const reports = await pool.query<{
        report_id: string;
        title: string;
        status: string;
        created_at: string;
        unlocked_at: string | null;
        diagnostic_id: string;
        score: number;
        criticality: string;
      }>(
        `SELECT
           r.id AS report_id,
           r.title,
           r.status,
           r.created_at,
           r.unlocked_at,
           r.diagnostic_id,
           d.score,
           d.criticality
         FROM app_users u
         JOIN reports r ON r.user_id = u.id
         JOIN linkedin_diagnostics d ON d.id = r.diagnostic_id
         WHERE u.email = $1
         ORDER BY r.created_at DESC`,
        [email],
      );

      res.json({ reports: reports.rows });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao listar relatórios: ${details}` });
    }
  });

  app.get("/api/reports/:reportId", async (req, res) => {
    const { reportId } = req.params;
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Informe um e-mail válido para acessar o relatório." });
      return;
    }

    try {
      const pool = getDbPool();
      const report = await pool.query<{
        id: string;
        title: string;
        content: string;
        status: string;
        unlocked_at: string | null;
        diagnostic_id: string;
      }>(
        `SELECT r.id, r.title, r.content, r.status, r.unlocked_at, r.diagnostic_id
         FROM reports r
         JOIN app_users u ON u.id = r.user_id
         WHERE r.id = $1 AND u.email = $2`,
        [reportId, email],
      );

      if (report.rowCount === 0) {
        res.status(404).json({ error: "Relatório não encontrado para este usuário." });
        return;
      }

      res.json({ report: report.rows[0] });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao obter relatório: ${details}` });
    }
  });

  app.post("/api/reports/:reportId/regenerate", async (req, res) => {
    const { reportId } = req.params;
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Informe um e-mail válido." });
      return;
    }

    try {
      const pool = getDbPool();
      const result = await pool.query<{
        id: string;
        status: string;
        diagnostic_id: string;
        score: number;
        criticality: string;
        normalized_linkedin_url: string;
        raw_analysis: DiagnosticAnalysis;
      }>(
        `SELECT r.id, r.status, r.diagnostic_id,
                d.score, d.criticality, d.normalized_linkedin_url, d.raw_analysis
         FROM reports r
         JOIN app_users u ON u.id = r.user_id
         JOIN linkedin_diagnostics d ON d.id = r.diagnostic_id
         WHERE r.id = $1 AND u.email = $2`,
        [reportId, email],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Relatório não encontrado para este usuário." });
        return;
      }

      const row = result.rows[0];
      if (row.status !== "unlocked") {
        res.status(403).json({ error: "Relatório ainda não liberado." });
        return;
      }

      const analysis = row.raw_analysis as DiagnosticAnalysis;
      const fullContent = await generateFullReportContent(row.normalized_linkedin_url, analysis);
      await pool.query(`UPDATE reports SET content = $1 WHERE id = $2`, [fullContent, reportId]);

      res.json({ ok: true, reportId });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao regenerar: ${details}` });
    }
  });

  app.get("/api/reports/:reportId/download", async (req, res) => {
    const { reportId } = req.params;
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Informe um e-mail válido para baixar o relatório." });
      return;
    }

    try {
      const pool = getDbPool();
      const result = await pool.query<{
        id: string;
        title: string;
        content: string;
        status: string;
        unlocked_at: string | null;
        diagnostic_id: string;
        score: number;
        criticality: string;
        normalized_linkedin_url: string;
      }>(
        `SELECT r.id, r.title, r.content, r.status, r.unlocked_at, r.diagnostic_id,
                d.score, d.criticality, d.normalized_linkedin_url
         FROM reports r
         JOIN app_users u ON u.id = r.user_id
         JOIN linkedin_diagnostics d ON d.id = r.diagnostic_id
         WHERE r.id = $1 AND u.email = $2`,
        [reportId, email],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Relatório não encontrado para este usuário." });
        return;
      }

      const row = result.rows[0];

      if (row.status !== "unlocked") {
        res.status(403).json({ error: "Relatório ainda não liberado. Confirme o pagamento para fazer o download." });
        return;
      }

      const html = buildReportHtml(
        row.title,
        row.content,
        row.normalized_linkedin_url,
        row.score,
        row.criticality,
        row.unlocked_at ?? new Date().toISOString(),
      );

      const safeTitle = row.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.html"`);
      res.send(html);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao gerar download: ${details}` });
    }
  });

  app.get("/api/linkedin-diagnostic/funnel-metrics", async (_req, res) => {
    try {
      const pool = getDbPool();
      const stats = await pool.query<{
        diagnostics: string;
        checkouts: string;
        paid: string;
      }>(`
        SELECT
          (SELECT COUNT(*)::text FROM linkedin_diagnostics) AS diagnostics,
          (SELECT COUNT(*)::text FROM checkout_orders) AS checkouts,
          (SELECT COUNT(*)::text FROM checkout_orders WHERE status = 'paid') AS paid
      `);

      const row = stats.rows[0];
      const diagnostics = Number.parseInt(row.diagnostics, 10);
      const checkouts = Number.parseInt(row.checkouts, 10);
      const paid = Number.parseInt(row.paid, 10);

      res.json({
        diagnostics,
        checkouts,
        paid,
        conversionDiagnosticToPaid: diagnostics > 0 ? Number(((paid / diagnostics) * 100).toFixed(2)) : 0,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao calcular métricas: ${details}` });
    }
  });
}
