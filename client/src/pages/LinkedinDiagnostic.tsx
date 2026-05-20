import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import NeuralBackground from "@/components/NeuralBackground";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

type DiagnosticResponse = {
  diagnosticId: string;
  score: number;
  criticality: Criticality;
  summary: string;
  areaScores: AreaScore[];
  opportunities: Opportunity[];
  methodologyImprovements: string[];
};

type CheckoutResponse = {
  checkoutId: string;
  status: "pending" | "paid";
  amountCents: number;
  currency: string;
  paymentMethod: "pix";
  provider?: "mock" | "mercadopago";
  pixCode: string;
  pixQrData: string;
  paymentReference: string;
};

type ReportItem = {
  report_id: string;
  title: string;
  status: string;
  created_at: string;
  unlocked_at: string | null;
  diagnostic_id: string;
  score: number;
  criticality: string;
};

type ReportPayload = {
  id: string;
  title: string;
  content: string;
  status: string;
  unlocked_at: string | null;
  diagnostic_id: string;
};

const VISITOR_STORAGE_KEY = "taktia.visitor.id";

function getVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const next = `visitor_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  window.localStorage.setItem(VISITOR_STORAGE_KEY, next);
  return next;
}

function criticalityLabel(level: Criticality) {
  if (level === "alta") return "Alta prioridade";
  if (level === "media") return "Média prioridade";
  return "Baixa prioridade";
}

function criticalityClass(level: Criticality) {
  if (level === "alta") return "bg-red-500/20 text-red-200 border-red-300/40";
  if (level === "media") return "bg-amber-500/20 text-amber-200 border-amber-300/40";
  return "bg-emerald-500/20 text-emerald-200 border-emerald-300/40";
}

export default function LinkedinDiagnosticPage() {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinPdf, setLinkedinPdf] = useState<File | null>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);

  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [authMethod, setAuthMethod] = useState<"google" | "manual">("google");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);

  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingPaymentStatus, setLoadingPaymentStatus] = useState(false);

  const [reportsEmail, setReportsEmail] = useState("");
  const [loadingReports, setLoadingReports] = useState(false);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [activeReport, setActiveReport] = useState<ReportPayload | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const hasDiagnostic = !!diagnostic;

  const scoreTone = useMemo(() => {
    if (!diagnostic) return "text-cyan-200";
    if (diagnostic.score < 55) return "text-red-200";
    if (diagnostic.score < 70) return "text-amber-200";
    return "text-emerald-200";
  }, [diagnostic]);

  async function handleGenerateDiagnostic() {
    if (!linkedinUrl.trim()) {
      toast.error("Cole a URL do seu perfil LinkedIn para iniciar o diagnóstico.");
      return;
    }

    setLoadingDiagnostic(true);
    setDiagnostic(null);
    setCheckout(null);

    try {
      const visitorId = getVisitorId();
      const response = linkedinPdf
        ? await (async () => {
            const form = new FormData();
            form.append("profilePdf", linkedinPdf);
            form.append("linkedinUrl", linkedinUrl);
            form.append("visitorId", visitorId);

            return fetch("/api/linkedin-diagnostic/from-pdf", {
              method: "POST",
              body: form,
            });
          })()
        : await fetch("/api/linkedin-diagnostic", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              linkedinUrl,
              visitorId,
            }),
          });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao gerar diagnóstico.");
      }

      setDiagnostic(payload as DiagnosticResponse);
      toast.success(linkedinPdf ? "Diagnóstico gerado com base no PDF do LinkedIn." : "Diagnóstico inicial gerado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível gerar o diagnóstico agora.";
      toast.error(message);
    } finally {
      setLoadingDiagnostic(false);
    }
  }

  async function handleCreateCheckout() {
    if (!diagnostic) {
      toast.error("Gere o diagnóstico antes de ir para o checkout.");
      return;
    }

    if (!buyerEmail.trim()) {
      toast.error("Informe seu e-mail para vincular o relatório.");
      return;
    }

    if (!acceptTerms) {
      toast.error("Você precisa aceitar os termos para continuar.");
      return;
    }

    setLoadingCheckout(true);

    try {
      const response = await fetch(`/api/linkedin-diagnostic/${diagnostic.diagnosticId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: buyerEmail,
          name: buyerName,
          authMethod,
          acceptTerms,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao criar checkout.");
      }

      setCheckout(payload as CheckoutResponse);
      setReportsEmail(buyerEmail.trim());
      toast.success("Checkout Pix criado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir o checkout.";
      toast.error(message);
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function handleConfirmPayment() {
    if (!checkout) {
      toast.error("Crie o checkout Pix antes de confirmar pagamento.");
      return;
    }

    setLoadingPayment(true);

    try {
      const response = await fetch(`/api/checkout/${checkout.checkoutId}/confirm-payment`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao confirmar pagamento.");
      }

      toast.success("Pagamento confirmado e relatório liberado.");
      await handleLoadReports();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível confirmar o pagamento.";
      toast.error(message);
    } finally {
      setLoadingPayment(false);
    }
  }

  async function handleCheckPaymentStatus() {
    if (!checkout) {
      toast.error("Crie o checkout Pix antes de consultar status.");
      return;
    }

    setLoadingPaymentStatus(true);

    try {
      const response = await fetch(`/api/checkout/${checkout.checkoutId}/status`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao verificar status do pagamento.");
      }

      const isPaid = payload.status === "paid";
      if (isPaid) {
        toast.success("Pagamento identificado e relatório liberado.");
        await handleLoadReports();
        return;
      }

      toast.message("Pagamento ainda pendente. Assim que o Pix confirmar, o relatório será liberado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível consultar o pagamento.";
      toast.error(message);
    } finally {
      setLoadingPaymentStatus(false);
    }
  }

  async function handleLoadReports() {
    if (!reportsEmail.trim()) {
      toast.error("Informe um e-mail para buscar seus relatórios.");
      return;
    }

    setLoadingReports(true);

    try {
      const query = new URLSearchParams({ email: reportsEmail.trim() });
      const response = await fetch(`/api/my/reports?${query.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao carregar relatórios.");
      }

      setReports(payload.reports as ReportItem[]);
      if ((payload.reports as ReportItem[]).length === 0) {
        toast.message("Nenhum relatório encontrado para este e-mail.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível carregar os relatórios.";
      toast.error(message);
    } finally {
      setLoadingReports(false);
    }
  }

  async function handleOpenReport(reportId: string) {
    if (!reportsEmail.trim()) {
      toast.error("Informe um e-mail válido para abrir o relatório.");
      return;
    }

    setLoadingReport(true);

    try {
      const query = new URLSearchParams({ email: reportsEmail.trim() });
      const response = await fetch(`/api/reports/${reportId}?${query.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao abrir relatório.");
      }

      setActiveReport(payload.report as ReportPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir o relatório.";
      toast.error(message);
    } finally {
      setLoadingReport(false);
    }
  }

  return (
    <div className="min-h-screen bg-neural-deep text-foreground overflow-x-hidden">
      <NeuralBackground />
      <Navbar />

      <main className="relative z-10">
        <section className="container pt-28 pb-8">
          <div className="max-w-3xl space-y-6">
            <Badge className="bg-cyan/20 text-cyan-bright border-cyan/40">Diagnóstico LinkedIn Taktia</Badge>
            <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight">
              Transforme seu perfil em uma máquina de oportunidades profissionais.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Cole a URL do seu LinkedIn e receba uma análise profissional automatizada com pontuação,
              criticidade e principais melhorias para elevar autoridade, empregabilidade e conversão.
            </p>
          </div>
        </section>

        <section className="container pb-8">
          <Card className="glass-card border-cyan/30">
            <CardHeader>
              <CardTitle>1. Gerar diagnóstico inicial</CardTitle>
              <CardDescription>
                Sem consultoria manual no primeiro contato: resultado imediato para você enxergar valor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl">URL do perfil LinkedIn</Label>
                <Input
                  id="linkedinUrl"
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="https://www.linkedin.com/in/seu-perfil"
                  className="bg-neural-mid/70 border-cyan/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedinPdf">PDF do perfil (opcional, recomendado)</Label>
                <Input
                  id="linkedinPdf"
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setLinkedinPdf(event.target.files?.[0] ?? null)}
                  className="bg-neural-mid/70 border-cyan/30 file:text-cyan-bright"
                />
                <p className="text-xs text-muted-foreground">
                  Se anexar o PDF exportado do LinkedIn, o diagnóstico usa esse conteúdo e fica mais específico.
                </p>
              </div>

              <Button onClick={handleGenerateDiagnostic} disabled={loadingDiagnostic} className="w-full sm:w-auto">
                {loadingDiagnostic ? "Analisando perfil..." : "Gerar diagnóstico"}
              </Button>
            </CardContent>
          </Card>
        </section>

        {diagnostic && (
          <section className="container pb-8">
            <Card className="glass-card border-emerald-400/25">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle>2. Resultado do diagnóstico</CardTitle>
                  <Badge className={`${criticalityClass(diagnostic.criticality)} capitalize`}>
                    {criticalityLabel(diagnostic.criticality)}
                  </Badge>
                </div>
                <CardDescription>
                  Leitura inicial com foco em atratividade, confiança e potencial de conversão.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="text-sm uppercase tracking-wide text-muted-foreground">Score</div>
                  <div className={`text-4xl font-bold ${scoreTone}`}>{diagnostic.score}</div>
                  <div className="text-muted-foreground">/ 100</div>
                </div>

                <p className="text-base leading-relaxed text-muted-foreground">{diagnostic.summary}</p>

                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-cyan-bright">Notas por área (sem plano de ação nesta etapa)</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {diagnostic.areaScores.map((item) => (
                      <article key={item.area} className="rounded-xl border border-cyan/25 bg-neural-mid/55 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm text-cyan-100">{item.area}</strong>
                          <Badge variant="outline" className="border-cyan/40 text-cyan-100">
                            {item.score}/100
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.justification}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  {diagnostic.opportunities.map((opportunity, index) => (
                    <article
                      key={`${opportunity.title}-${index}`}
                      className="rounded-xl border border-cyan/25 bg-neural-mid/55 p-4 space-y-2"
                    >
                      <h3 className="font-semibold text-cyan-bright">
                        {index + 1}. {opportunity.title}
                      </h3>
                      <p className="text-sm text-foreground/90">
                        <strong>Impacto:</strong> {opportunity.impact}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Motivo:</strong> {opportunity.reason}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-amber-100">Como melhorar a próxima avaliação</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-amber-50/90">
                    {diagnostic.methodologyImprovements.map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="container pb-8">
          <Card className="glass-card border-cyan/30">
            <CardHeader>
              <CardTitle>3. Comprar relatório completo (Pix)</CardTitle>
              <CardDescription>
                Faça login com Google ou cadastro manual no momento da compra e libere o relatório completo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buyerName">Nome (opcional)</Label>
                  <Input
                    id="buyerName"
                    value={buyerName}
                    onChange={(event) => setBuyerName(event.target.value)}
                    placeholder="Seu nome"
                    className="bg-neural-mid/70 border-cyan/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buyerEmail">E-mail para acessar o relatório</Label>
                  <Input
                    id="buyerEmail"
                    type="email"
                    value={buyerEmail}
                    onChange={(event) => setBuyerEmail(event.target.value)}
                    placeholder="voce@empresa.com"
                    className="bg-neural-mid/70 border-cyan/30"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={authMethod === "google" ? "default" : "outline"}
                  onClick={() => setAuthMethod("google")}
                  className="justify-start"
                >
                  <ShieldCheck className="size-4" />
                  Login com Google
                </Button>
                <Button
                  type="button"
                  variant={authMethod === "manual" ? "default" : "outline"}
                  onClick={() => setAuthMethod("manual")}
                  className="justify-start"
                >
                  <Lock className="size-4" />
                  Cadastro manual
                </Button>
              </div>

              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  className="mt-1"
                />
                Aceito os termos de uso e a política de privacidade para vincular diagnóstico, pagamento e relatório.
              </label>

              <Button onClick={handleCreateCheckout} disabled={!hasDiagnostic || loadingCheckout}>
                {loadingCheckout ? "Criando checkout Pix..." : "Gerar cobrança Pix"}
              </Button>

              {!hasDiagnostic && (
                <p className="text-xs text-amber-200 flex items-center gap-2">
                  <AlertCircle className="size-4" />
                  Gere o diagnóstico inicial para habilitar o checkout.
                </p>
              )}

              {checkout && (
                <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-900/20 p-4">
                  <div className="flex items-center gap-2 text-emerald-200 font-medium">
                    <CheckCircle2 className="size-4" />
                    Checkout criado com sucesso
                  </div>
                  <p className="text-sm text-foreground/90">
                    Valor: {(checkout.amountCents / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: checkout.currency,
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Provedor Pix: {checkout.provider === "mercadopago" ? "Mercado Pago" : "Simulação local"}
                  </p>
                  <p className="text-sm text-muted-foreground">Referência: {checkout.paymentReference}</p>
                  <div className="space-y-1">
                    <Label>Código Pix (copia e cola)</Label>
                    <Textarea value={checkout.pixCode} readOnly className="min-h-20 bg-neural-dark border-cyan/30" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleCheckPaymentStatus} disabled={loadingPaymentStatus}>
                      {loadingPaymentStatus ? "Consultando..." : "Verificar status do Pix"}
                    </Button>
                    <Button onClick={handleConfirmPayment} disabled={loadingPayment}>
                      {loadingPayment ? "Confirmando pagamento..." : "Já paguei, confirmar agora"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="container pb-16">
          <Card className="glass-card border-cyan/30">
            <CardHeader>
              <CardTitle>4. Minha área de relatórios</CardTitle>
              <CardDescription>
                Acompanhe seus relatórios adquiridos usando o e-mail vinculado no checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                <Input
                  type="email"
                  value={reportsEmail}
                  onChange={(event) => setReportsEmail(event.target.value)}
                  placeholder="Seu e-mail de compra"
                  className="bg-neural-mid/70 border-cyan/30"
                />
                <Button onClick={handleLoadReports} disabled={loadingReports}>
                  {loadingReports ? "Buscando..." : "Buscar relatórios"}
                </Button>
              </div>

              <Separator className="bg-cyan/20" />

              <div className="grid gap-3">
                {reports.map((item) => (
                  <div
                    key={item.report_id}
                    className="rounded-xl border border-cyan/25 bg-neural-mid/45 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Score {item.score} | Criticidade {item.criticality} | Status {item.status}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => handleOpenReport(item.report_id)} disabled={loadingReport}>
                      Abrir
                    </Button>
                    {item.status === "unlocked" && (
                      <Button
                        variant="ghost"
                        asChild
                      >
                        <a
                          href={`/api/reports/${item.report_id}/download?email=${encodeURIComponent(reportsEmail.trim())}`}
                          download
                        >
                          Baixar HTML
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {activeReport && (
                <div className="rounded-xl border border-cyan/35 bg-neural-mid/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-bright font-medium">
                    <Sparkles className="size-4" />
                    {activeReport.title}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status: {activeReport.status}
                    {activeReport.unlocked_at ? ` | Liberado em ${new Date(activeReport.unlocked_at).toLocaleString("pt-BR")}` : ""}
                  </p>
                  <Textarea value={activeReport.content} readOnly className="min-h-52 bg-neural-dark border-cyan/30" />
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
