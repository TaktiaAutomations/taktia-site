/*
 * Design: Neural Network Organic Tech
 * Hero com imagem de fundo neural, texto grande com glow, partículas
 * Cores: azul profundo, ciano elétrico, verde glow
 * Tipografia: Space Grotesk display, DM Sans body
 */

import AnimatedSection from "@/components/AnimatedSection";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Cpu, Workflow } from "lucide-react";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028645448/dRC2vwqXdbFAkjBWKkzxXT/hero-bg-gw5b5tKRT67CGuGUed54Yo.webp";

export default function HeroSection() {
  const handleScroll = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={HERO_BG}
          alt=""
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neural-deep/60 via-neural-deep/40 to-neural-deep" />
        <div className="absolute inset-0 bg-gradient-to-r from-neural-deep/80 via-transparent to-neural-deep/80" />
      </div>

      {/* Content */}
      <div className="container relative z-10 pt-32 pb-20">
        <div className="max-w-4xl">
          {/* Badge */}
          <AnimatedSection delay={0.1} direction="up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan/20 bg-cyan/5 mb-8">
              <div className="w-2 h-2 rounded-full bg-green-glow animate-pulse" />
              <span className="text-sm font-medium text-cyan">
                Inteligência Artificial & Automação
              </span>
            </div>
          </AnimatedSection>

          {/* Title */}
          <AnimatedSection delay={0.2} direction="up">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold font-display tracking-tight leading-[0.95] mb-8">
              Transforme sua{" "}
              <br className="hidden sm:block" />
              empresa com{" "}
              <br className="hidden sm:block" />
              <span className="gradient-text">automação</span>{" "}
              <br className="hidden sm:block" />
              <span className="glow-text text-cyan">inteligente</span>
            </h1>
          </AnimatedSection>

          {/* Subtitle */}
          <AnimatedSection delay={0.4} direction="up">
            <p className="text-lg sm:text-xl text-foreground/60 max-w-2xl leading-relaxed mb-10">
              Integração de plataformas, atendimento com IA e automação de
              processos para impulsionar sua eficiência operacional com
              tecnologia de ponta.
            </p>
          </AnimatedSection>

          {/* CTA Buttons */}
          <AnimatedSection delay={0.5} direction="up">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleScroll("#servicos")}
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan to-green-glow text-neural-deep font-semibold text-base hover:shadow-xl hover:shadow-cyan/25 transition-all duration-300 hover:scale-105"
              >
                Conheça nossas soluções
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
              <button
                onClick={() => handleScroll("#contato")}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl border border-cyan/30 text-foreground/90 font-semibold text-base hover:bg-cyan/5 hover:border-cyan/50 transition-all duration-300"
              >
                Solicite uma demonstração
              </button>
            </div>
          </AnimatedSection>

          {/* Feature Pills */}
          <AnimatedSection delay={0.7} direction="up">
            <div className="flex flex-wrap gap-4 mt-16">
              {[
                { icon: Cpu, label: "Integração de Plataformas" },
                { icon: Bot, label: "Atendimento com IA" },
                { icon: Workflow, label: "Automação de Atividades" },
              ].map(({ icon: Icon, label }) => (
                <motion.div
                  key={label}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="flex items-center gap-3 px-5 py-3 rounded-xl glass-card"
                >
                  <Icon size={18} className="text-cyan" />
                  <span className="text-sm font-medium text-foreground/80">
                    {label}
                  </span>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-neural-deep to-transparent" />
    </section>
  );
}
