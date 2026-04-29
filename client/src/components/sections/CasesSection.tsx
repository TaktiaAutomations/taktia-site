/*
 * Design: Neural Network Organic Tech
 * Seção de cases/depoimentos com cards glassmorphism
 * Aspas decorativas, animações stagger
 */

import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "A implementação do sistema de atendimento com IA da Taktia reduziu nosso tempo de resposta em 70% e aumentou a satisfação dos clientes em 45%. Uma transformação completa em nossa operação de suporte.",
    author: "Carlos Silva",
    role: "Diretor de Operações",
    company: "TechSolutions",
    rating: 5,
  },
  {
    quote:
      "A integração entre nosso CRM e ERP feita pela Taktia eliminou completamente a duplicação de dados e nos economizou mais de 200 horas mensais de trabalho manual. O ROI foi alcançado em apenas 3 meses.",
    author: "Ana Rodrigues",
    role: "Gerente de TI",
    company: "InnovaGroup",
    rating: 5,
  },
  {
    quote:
      "Os chatbots desenvolvidos pela Taktia atendem 80% das demandas dos nossos clientes de forma autônoma, com uma taxa de satisfação impressionante. A equipe é extremamente competente e dedicada.",
    author: "Ricardo Mendes",
    role: "CEO",
    company: "DataFlow",
    rating: 5,
  },
];

export default function CasesSection() {
  return (
    <section id="cases" className="relative py-24 sm:py-32">
      <div className="container">
        {/* Section Header */}
        <AnimatedSection className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[2px] bg-gradient-to-r from-cyan to-transparent" />
            <span className="text-sm font-semibold text-cyan uppercase tracking-widest">
              Cases de Sucesso
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight max-w-3xl">
            Histórias de{" "}
            <span className="gradient-text">transformação</span>
          </h2>
          <p className="text-lg text-foreground/50 mt-6 max-w-2xl">
            Conheça os resultados reais que nossas soluções de automação e IA
            entregaram para nossos clientes.
          </p>
        </AnimatedSection>

        {/* Testimonials */}
        <StaggerContainer
          staggerDelay={0.15}
          className="grid md:grid-cols-3 gap-6"
        >
          {testimonials.map((t) => (
            <StaggerItem key={t.author}>
              <motion.div
                whileHover={{ y: -6 }}
                className="glass-card rounded-2xl p-8 h-full flex flex-col relative overflow-hidden group"
              >
                {/* Decorative gradient */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan to-green-glow opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Quote icon */}
                <Quote
                  size={32}
                  className="text-cyan/20 mb-4 shrink-0"
                />

                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className="text-green-glow fill-green-glow"
                    />
                  ))}
                </div>

                {/* Quote text */}
                <p className="text-foreground/70 leading-relaxed text-sm flex-1 mb-6">
                  "{t.quote}"
                </p>

                {/* Author */}
                <div className="border-t border-cyan/10 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan/30 to-green-glow/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-cyan">
                        {t.author.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {t.author}
                      </div>
                      <div className="text-xs text-foreground/40">
                        {t.role}, {t.company}
                      </div>
                    </div>
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
