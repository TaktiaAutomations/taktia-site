/*
 * Chatbot da Taktia com agente no backend via OpenAI
 * Mantem uma base local como fallback para nao quebrar a experiencia
 */

import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CHAT_STORAGE_KEY = "taktia-chat-session-id";
const DEFAULT_FALLBACK_RESPONSE =
  "Não consegui responder agora. Posso te conectar com a equipe da Taktia pelo WhatsApp (34) 99859-2724 ou pelo e-mail taktia@taktia.com.br.";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ChatApiResponse {
  reply?: string;
  source?: string;
  error?: string;
}

// Base de conhecimento da Taktia
const knowledgeBase: { keywords: string[]; response: string }[] = [
  {
    keywords: ["horário", "horario", "funcionamento", "aberto", "abre", "fecha", "expediente"],
    response:
      "Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Mas nosso assistente virtual está disponível 24/7 para dúvidas rápidas!",
  },
  {
    keywords: ["preço", "preco", "valor", "custo", "quanto custa", "investimento", "orçamento", "orcamento"],
    response:
      "Os valores variam de acordo com a complexidade e escopo do projeto. Cada solução é personalizada para atender suas necessidades. Que tal preencher nosso formulário de contato para receber uma proposta sob medida?",
  },
  {
    keywords: ["serviço", "servico", "serviços", "servicos", "o que fazem", "o que vocês fazem", "oferecem"],
    response:
      "Oferecemos três serviços principais:\n\n1. **Integração de Plataformas** — conectamos seus sistemas (CRM, ERP, etc.) para trabalharem em harmonia.\n\n2. **Atendimento com IA** — chatbots e assistentes virtuais inteligentes.\n\n3. **Automação de Atividades** — automatizamos tarefas repetitivas com RPA e workflows.",
  },
  {
    keywords: ["integração", "integracao", "integrar", "plataforma", "crm", "erp", "api", "sistema"],
    response:
      "Nossa Integração de Plataformas conecta seus diferentes sistemas (CRM, ERP, e-commerce, etc.) para que trabalhem em perfeita harmonia. Eliminamos silos de informação e garantimos fluxo contínuo de dados entre suas ferramentas.",
  },
  {
    keywords: ["chatbot", "chat bot", "atendimento", "assistente", "bot", "ia", "inteligência artificial", "inteligencia artificial"],
    response:
      "Desenvolvemos chatbots e assistentes virtuais com IA avançada, incluindo processamento de linguagem natural (NLP). Eles podem atender seus clientes 24/7, automatizar respostas frequentes e escalar para atendentes humanos quando necessário.",
  },
  {
    keywords: ["automação", "automacao", "automatizar", "rpa", "workflow", "processo", "tarefa", "repetitiva"],
    response:
      "Nossa Automação de Atividades utiliza RPA e workflows inteligentes para automatizar tarefas repetitivas. Isso libera sua equipe para atividades estratégicas, reduz erros e aumenta a produtividade significativamente.",
  },
  {
    keywords: ["contato", "falar", "email", "e-mail", "telefone", "whatsapp", "ligar"],
    response:
      "Você pode nos contatar por:\n\n📧 **E-mail:** taktia@taktia.com.br\n📱 **WhatsApp:** (34) 99859-2724\n📍 **Localização:** Uberlândia, MG\n\nOu preencha o formulário de contato aqui no site!",
  },
  {
    keywords: ["localização", "localizacao", "onde ficam", "endereço", "endereco", "cidade", "uberlândia", "uberlandia"],
    response:
      "Estamos localizados em Uberlândia, MG - Brasil. Atendemos clientes em todo o território nacional, com possibilidade de reuniões presenciais e remotas.",
  },
  {
    keywords: ["prazo", "tempo", "demora", "quanto tempo", "implementação", "implementacao"],
    response:
      "O prazo varia conforme a complexidade do projeto. Utilizamos metodologia ágil com entregas iterativas, então você começa a ver resultados desde as primeiras semanas. Para um orçamento detalhado com cronograma, entre em contato conosco!",
  },
  {
    keywords: ["sobre", "quem são", "quem sao", "empresa", "taktia", "história", "historia"],
    response:
      "A Taktia Automações nasceu da visão de unir inteligência humana com tecnologia. Somos especialistas em automação inteligente, criando soluções personalizadas que otimizam processos, reduzem custos e aumentam a produtividade das empresas.",
  },
  {
    keywords: ["olá", "ola", "oi", "bom dia", "boa tarde", "boa noite", "hello", "hey", "e aí", "eai"],
    response:
      "Olá! 👋 Sou o assistente virtual da Taktia. Posso ajudar com informações sobre nossos serviços, contato, horários e muito mais. Como posso ajudá-lo?",
  },
  {
    keywords: ["obrigado", "obrigada", "valeu", "agradeço", "thanks"],
    response:
      "Por nada! Fico feliz em ajudar. Se tiver mais alguma dúvida, estou por aqui. 😊",
  },
  {
    keywords: ["segurança", "seguranca", "seguro", "dados", "lgpd", "privacidade"],
    response:
      "Levamos segurança muito a sério! Todas as nossas soluções são desenvolvidas com os mais altos padrões de segurança e em conformidade com a LGPD. Seus dados estão protegidos conosco.",
  },
];

function findResponse(userMessage: string): string | null {
  const normalizedMsg = userMessage
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const entry of knowledgeBase) {
    for (const keyword of entry.keywords) {
      const normalizedKeyword = keyword
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalizedMsg.includes(normalizedKeyword)) {
        return entry.response;
      }
    }
  }
  return null;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Olá! 👋 Sou o assistente virtual da Taktia. Como posso ajudá-lo hoje?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const existingSessionId = window.localStorage.getItem(CHAT_STORAGE_KEY);
    const sessionId = existingSessionId || window.crypto.randomUUID();

    if (!existingSessionId) {
      window.localStorage.setItem(CHAT_STORAGE_KEY, sessionId);
    }

    sessionIdRef.current = sessionId;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const requestBackendReply = async (userMessage: string, history: Message[]) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        sessionId: sessionIdRef.current,
        pageUrl: window.location.href,
        history: history.slice(-12).map((message) => ({
          role: message.sender === "user" ? "user" : "assistant",
          content: message.text,
        })),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as ChatApiResponse;
    return {
      ok: response.ok,
      reply: data.reply?.trim() || null,
    };
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: Message = {
      id: Date.now(),
      text: trimmed,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

    try {
      const historySnapshot = [...messages, userMsg];
      const apiResponse = await requestBackendReply(trimmed, historySnapshot);
      const fallbackResponse = findResponse(trimmed);
      const botText = apiResponse.reply ?? fallbackResponse ?? DEFAULT_FALLBACK_RESPONSE;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: botText,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } catch {
      const fallbackResponse = findResponse(trimmed) ?? DEFAULT_FALLBACK_RESPONSE;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: fallbackResponse,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* FAB Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan to-green-glow text-neural-deep shadow-xl shadow-cyan/30 flex items-center justify-center hover:scale-110 transition-transform duration-300"
        whileTap={{ scale: 0.9 }}
        aria-label="Abrir chat"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse ring */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-cyan/30 animate-ping" />
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-cyan/20 shadow-2xl shadow-cyan/10 flex flex-col"
            style={{ background: "oklch(0.12 0.02 240)" }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-cyan/10 bg-neural-dark/50 backdrop-blur-xl flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan to-green-glow flex items-center justify-center">
                <Bot size={20} className="text-neural-deep" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">
                  Assistente Taktia
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-glow animate-pulse" />
                  <span className="text-xs text-foreground/40">Online</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-cyan/10 text-foreground/40 hover:text-foreground transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-cyan to-green-glow text-neural-deep rounded-br-md"
                        : "bg-neural-mid/60 text-foreground/80 border border-cyan/5 rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-neural-mid/60 border border-cyan/5 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-cyan/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-cyan/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-cyan/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-cyan/10 bg-neural-dark/30 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-neural-mid/50 border border-cyan/10 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-cyan/30 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-cyan to-green-glow text-neural-deep hover:shadow-lg hover:shadow-cyan/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
