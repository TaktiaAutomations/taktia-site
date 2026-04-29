/*
 * Design: Neural Network Organic Tech
 * Cards de diferenciais com glassmorphism, hover glow, stagger animation
 */

import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";
import { motion } from "framer-motion";
import { BarChart3, Fingerprint, HeadsetIcon, Settings2, Sparkles, Zap } from "lucide-react";

const differentials = [
  {
    icon: Settings2,
    title: "Soluções Personalizadas",
    description:
      "Desenvolvemos soluções sob medida para as necessidades específicas do seu negócio, não apenas implementamos ferramentas genéricas.",
  },
  {
    icon: BarChart3,
    title: "Resultados Mensuráveis",
    description:
      "Trabalhamos com métricas claras e KPIs definidos para garantir que você acompanhe o retorno sobre seu investimento.",
  },
  {
    icon: Fingerprint,
    title: "Segurança em Primeiro Lugar",
    description:
      "Todas as nossas soluções são desenvolvidas com os mais altos padrões de segurança para proteger seus dados.",
  },
  {
    icon: HeadsetIcon,
    title: "Suporte Contínuo",
    description:
      "Oferecemos suporte técnico especializado e acompanhamento constante para garantir funcionamento perfeito.",
  },
  {
    icon: Zap,
    title: "Implementação Ágil",
    description:
      "Metodologia ágil que permite entregas rápidas e iterativas, com resultados visíveis desde as primeiras semanas.",
  },
  {
    icon: Sparkles,
    title: "Tecnologia de Ponta",
    description:
      "Utilizamos as mais recentes tecnologias de IA e automação, incluindo modelos de linguagem avançados e machine learning.",
  },
];

export default function DifferentialsSection() {
  return (
    <section id="diferenciais" className="relative py-24 sm:py-32">
      {/* Decorative line */}
      <div className="neural-line w-full mb-20" />

      <div className="container">
        {/* Section Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-[2px] bg-gradient-to-r from-transparent to-cyan" />
            <span className="text-sm font-semibold text-cyan uppercase tracking-widest">
              Nossos Diferenciais
            </span>
            <div className="w-12 h-[2px] bg-gradient-to-r from-cyan to-transparent" />
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight">
            Por que escolher a{" "}
            <span className="gradient-text">Taktia</span>?
          </h2>
          <p className="text-lg text-foreground/50 mt-6 max-w-2xl mx-auto">
            Combinamos expertise técnica com visão estratégica para entregar
            resultados que transformam negócios.
          </p>
        </AnimatedSection>

        {/* Cards Grid */}
        <StaggerContainer
          staggerDelay={0.1}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {differentials.map((item) => (
            <StaggerItem key={item.title}>
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="glass-card rounded-2xl p-8 h-full group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/20 to-green-glow/10 flex items-center justify-center mb-6 group-hover:from-cyan/30 group-hover:to-green-glow/20 transition-all duration-300">
                  <item.icon
                    size={24}
                    className="text-cyan group-hover:text-cyan-bright transition-colors"
                  />
                </div>
                <h3 className="text-xl font-bold font-display mb-3 group-hover:text-cyan transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-foreground/50 leading-relaxed text-sm">
                  {item.description}
                </p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
