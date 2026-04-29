/*
 * Design: Neural Network Organic Tech
 * Cards de serviço com glassmorphism, imagens geradas, hover effects
 * Stagger animation ao scroll
 */

import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";
import { motion } from "framer-motion";
import { ArrowUpRight, Bot, Cpu, Workflow } from "lucide-react";

const SERVICE_INTEGRATION = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028645448/dRC2vwqXdbFAkjBWKkzxXT/service-integration-DkednncrL6YckBjwNNe3Co.webp";
const SERVICE_AI = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028645448/dRC2vwqXdbFAkjBWKkzxXT/service-ai-MzUNR4GH7KEPzpHPYZWDxo.webp";
const SERVICE_AUTOMATION = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028645448/dRC2vwqXdbFAkjBWKkzxXT/service-automation-ChVMoF82XYGLJsYk3W7uav.webp";

const services = [
  {
    icon: Cpu,
    title: "Integração de Plataformas",
    description:
      "Conectamos suas diferentes plataformas e sistemas para que trabalhem em perfeita harmonia, eliminando silos de informação e garantindo fluxo contínuo de dados.",
    features: [
      "Integração entre CRM, ERP e sistemas legados",
      "APIs personalizadas para conectar aplicações",
      "Sincronização automática de dados",
      "Dashboards unificados",
    ],
    image: SERVICE_INTEGRATION,
    color: "from-cyan to-blue-500",
  },
  {
    icon: Bot,
    title: "Atendimento com IA",
    description:
      "Transforme a experiência dos seus clientes com soluções de atendimento inteligente que combinam a eficiência da IA com o toque humano quando necessário.",
    features: [
      "Chatbots personalizados para seu negócio",
      "Assistentes virtuais com NLP avançado",
      "Automação de respostas frequentes",
      "Integração com canais existentes",
    ],
    image: SERVICE_AI,
    color: "from-green-glow to-cyan",
  },
  {
    icon: Workflow,
    title: "Automação de Atividades",
    description:
      "Automatize tarefas repetitivas e processos operacionais para liberar o potencial da sua equipe, reduzir erros e aumentar a produtividade.",
    features: [
      "RPA para tarefas repetitivas",
      "Workflows automatizados",
      "Automação de relatórios e análises",
      "Monitoramento e alertas automáticos",
    ],
    image: SERVICE_AUTOMATION,
    color: "from-blue-500 to-green-glow",
  },
];

export default function ServicesSection() {
  return (
    <section id="servicos" className="relative py-24 sm:py-32">
      <div className="container">
        {/* Section Header */}
        <AnimatedSection className="mb-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[2px] bg-gradient-to-r from-cyan to-transparent" />
            <span className="text-sm font-semibold text-cyan uppercase tracking-widest">
              Nossos Serviços
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight max-w-3xl">
            Soluções completas para{" "}
            <span className="gradient-text">automatizar</span> sua operação
          </h2>
          <p className="text-lg text-foreground/50 mt-6 max-w-2xl">
            Oferecemos um portfólio completo de serviços de automação e
            inteligência artificial para transformar seu negócio.
          </p>
        </AnimatedSection>

        {/* Services Grid */}
        <StaggerContainer staggerDelay={0.15} className="space-y-8">
          {services.map((service, index) => (
            <StaggerItem key={service.title} direction={index % 2 === 0 ? "left" : "right"}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="glass-card rounded-3xl overflow-hidden"
              >
                <div className={`grid lg:grid-cols-2 gap-0 ${index % 2 === 1 ? "lg:direction-rtl" : ""}`}>
                  {/* Image */}
                  <div className={`relative h-64 lg:h-auto min-h-[320px] overflow-hidden ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                    <img
                      src={service.image}
                      alt={service.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-${index % 2 === 0 ? "r" : "l"} from-transparent via-neural-deep/20 to-neural-deep/80`} />
                    {/* Icon badge */}
                    <div className="absolute top-6 left-6">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center shadow-lg`}>
                        <service.icon size={24} className="text-neural-deep" />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`p-8 sm:p-10 lg:p-12 flex flex-col justify-center ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                    <h3 className="text-2xl sm:text-3xl font-bold font-display mb-4">
                      {service.title}
                    </h3>
                    <p className="text-foreground/60 leading-relaxed mb-6">
                      {service.description}
                    </p>
                    <ul className="space-y-3 mb-8">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan mt-2 shrink-0" />
                          <span className="text-sm text-foreground/70">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => document.querySelector("#contato")?.scrollIntoView({ behavior: "smooth" })}
                      className="inline-flex items-center gap-2 text-cyan font-semibold text-sm group hover:gap-3 transition-all duration-300"
                    >
                      Saiba mais
                      <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
