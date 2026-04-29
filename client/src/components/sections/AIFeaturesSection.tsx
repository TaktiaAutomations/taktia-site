/*
 * Design: Neural Network Organic Tech
 * Seção dedicada a IA para reforçar referências a inteligência artificial
 * Visual futurista com animações e ícones
 */

import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";
import { motion } from "framer-motion";
import { Brain, Eye, MessageSquare, Network, Scan, TrendingUp } from "lucide-react";

const aiFeatures = [
  {
    icon: Brain,
    title: "Machine Learning",
    description: "Modelos de aprendizado de máquina que evoluem com seus dados e melhoram continuamente os resultados.",
  },
  {
    icon: MessageSquare,
    title: "Processamento de Linguagem Natural",
    description: "Compreensão avançada de texto e fala para interações mais naturais e eficientes com seus clientes.",
  },
  {
    icon: Eye,
    title: "Visão Computacional",
    description: "Análise inteligente de imagens e documentos para automatizar processos de verificação e classificação.",
  },
  {
    icon: Network,
    title: "Redes Neurais",
    description: "Arquiteturas de deep learning para resolver problemas complexos de previsão e classificação.",
  },
  {
    icon: Scan,
    title: "Reconhecimento de Padrões",
    description: "Identificação automática de padrões em grandes volumes de dados para insights estratégicos.",
  },
  {
    icon: TrendingUp,
    title: "Análise Preditiva",
    description: "Previsões baseadas em dados históricos para antecipar tendências e otimizar decisões de negócio.",
  },
];

export default function AIFeaturesSection() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.75_0.15_200_/_0.08),_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_oklch(0.78_0.2_145_/_0.06),_transparent_60%)]" />

      <div className="container relative">
        {/* Section Header */}
        <AnimatedSection className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-glow/20 bg-green-glow/5 mb-6">
            <Brain size={16} className="text-green-glow" />
            <span className="text-sm font-medium text-green-glow">
              Tecnologias de IA
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight">
            Inteligência Artificial{" "}
            <span className="gradient-text">de ponta</span>
          </h2>
          <p className="text-lg text-foreground/50 mt-6 max-w-2xl mx-auto">
            Utilizamos as mais avançadas tecnologias de IA para criar soluções
            que realmente transformam a forma como sua empresa opera.
          </p>
        </AnimatedSection>

        {/* AI Features Grid */}
        <StaggerContainer
          staggerDelay={0.08}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {aiFeatures.map((feature) => (
            <StaggerItem key={feature.title}>
              <motion.div
                whileHover={{ y: -4 }}
                className="relative group p-8 rounded-2xl border border-cyan/5 hover:border-cyan/20 bg-neural-dark/30 hover:bg-neural-dark/50 transition-all duration-500"
              >
                {/* Glow on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan/5 to-green-glow/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan/15 to-green-glow/10 flex items-center justify-center mb-5 group-hover:from-cyan/25 group-hover:to-green-glow/15 transition-all duration-300">
                    <feature.icon size={22} className="text-cyan" />
                  </div>

                  <h3 className="text-lg font-bold font-display mb-2 group-hover:text-cyan transition-colors duration-300">
                    {feature.title}
                  </h3>

                  <p className="text-sm text-foreground/45 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Corner decoration */}
                <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-cyan/0 group-hover:border-cyan/20 rounded-tr-lg transition-all duration-500" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-cyan/0 group-hover:border-cyan/20 rounded-bl-lg transition-all duration-500" />
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom text */}
        <AnimatedSection delay={0.3} className="text-center mt-16">
          <p className="text-foreground/30 text-sm max-w-xl mx-auto">
            Nossas soluções de IA são desenvolvidas com foco em resultados
            práticos e mensuráveis, sempre alinhadas às necessidades específicas
            de cada cliente.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
