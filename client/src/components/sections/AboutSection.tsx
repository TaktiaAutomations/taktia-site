/*
 * Design: Neural Network Organic Tech
 * Seção Sobre com layout assimétrico, imagem do cérebro IA/humano
 * Animações de fade-in ao scroll
 */

import AnimatedSection from "@/components/AnimatedSection";
import { useCountUp, useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Brain, Lightbulb, Shield, Users } from "lucide-react";

const ABOUT_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028645448/dRC2vwqXdbFAkjBWKkzxXT/about-visual-S2QNmBJKFMJga7h8mHUgpf.webp";

const stats = [
  { value: 98, suffix: "%", label: "Satisfação dos clientes" },
  { value: 500, suffix: "+", label: "Processos automatizados" },
  { value: 75, suffix: "%", label: "Redução de tempo operacional" },
  { value: 30, suffix: "+", label: "Integrações realizadas" },
];

function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.3 });
  const count = useCountUp(value, 2000, isVisible);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl sm:text-4xl font-bold font-display gradient-text">
        {count}{suffix}
      </div>
      <div className="text-sm text-foreground/50 mt-1">{label}</div>
    </div>
  );
}

export default function AboutSection() {
  return (
    <section id="sobre" className="relative py-24 sm:py-32">
      {/* Decorative line */}
      <div className="neural-line w-full mb-20" />

      <div className="container">
        {/* Section Header */}
        <AnimatedSection className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[2px] bg-gradient-to-r from-cyan to-transparent" />
            <span className="text-sm font-semibold text-cyan uppercase tracking-widest">
              Sobre a Taktia
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight max-w-3xl">
            Combinando{" "}
            <span className="gradient-text">inteligência humana</span> e
            tecnologia
          </h2>
        </AnimatedSection>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
          {/* Image */}
          <AnimatedSection direction="left" className="order-2 lg:order-1">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-cyan/10 to-green-glow/10 rounded-3xl blur-2xl" />
              <img
                src={ABOUT_IMG}
                alt="Fusão entre inteligência humana e artificial"
                className="relative rounded-2xl w-full shadow-2xl shadow-cyan/10"
              />
              {/* Floating badge */}
              <div className="absolute -bottom-6 -right-4 sm:right-8 glass-card rounded-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan to-green-glow flex items-center justify-center">
                    <Brain size={20} className="text-neural-deep" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">IA + Humano</div>
                    <div className="text-xs text-foreground/50">Sinergia perfeita</div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Text */}
          <div className="order-1 lg:order-2 space-y-6">
            <AnimatedSection delay={0.1} direction="right">
              <h3 className="text-2xl sm:text-3xl font-bold font-display">
                Quem Somos
              </h3>
            </AnimatedSection>

            <AnimatedSection delay={0.2} direction="right">
              <p className="text-foreground/60 leading-relaxed text-lg">
                A Taktia Automações nasceu da visão de unir o melhor da
                inteligência humana com o potencial transformador da tecnologia.
                Nosso nome e logo representam essa dualidade: o cérebro humano e
                os circuitos tecnológicos trabalhando em perfeita harmonia.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={0.3} direction="right">
              <p className="text-foreground/60 leading-relaxed">
                Somos especialistas em criar soluções personalizadas de automação
                que otimizam processos, reduzem custos operacionais e aumentam a
                produtividade das empresas. Nossa equipe multidisciplinar combina
                conhecimento técnico avançado com profunda compreensão dos
                desafios de negócios.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={0.4} direction="right">
              <div className="grid grid-cols-2 gap-4 pt-4">
                {[
                  { icon: Lightbulb, text: "Inovação constante" },
                  { icon: Users, text: "Equipe especializada" },
                  { icon: Shield, text: "Segurança garantida" },
                  { icon: Brain, text: "IA de ponta" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <Icon size={18} className="text-cyan shrink-0" />
                    <span className="text-sm font-medium text-foreground/70">
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>

        {/* Stats */}
        <AnimatedSection>
          <div className="glass-card rounded-2xl p-8 sm:p-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <StatCounter key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
