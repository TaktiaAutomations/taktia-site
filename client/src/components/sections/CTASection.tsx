/*
 * Design: Neural Network Organic Tech
 * CTA section com gradiente, glow effects
 */

import AnimatedSection from "@/components/AnimatedSection";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export default function CTASection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="neural-line w-full mb-20" />

      <div className="container">
        <AnimatedSection>
          <div className="relative rounded-3xl overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan/10 via-neural-dark to-green-glow/10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_oklch(0.75_0.15_200_/_0.15),_transparent_70%)]" />

            {/* Animated border */}
            <div className="absolute inset-0 rounded-3xl border border-cyan/20" />

            {/* Content */}
            <div className="relative px-8 sm:px-16 py-16 sm:py-24 text-center">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, type: "spring" }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan to-green-glow flex items-center justify-center mx-auto mb-8"
              >
                <Sparkles size={28} className="text-neural-deep" />
              </motion.div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display tracking-tight mb-6">
                Transforme sua empresa{" "}
                <span className="gradient-text">hoje mesmo</span>
              </h2>

              <p className="text-lg text-foreground/50 max-w-2xl mx-auto mb-10">
                Entre em contato conosco para uma avaliação gratuita e descubra
                como nossas soluções de automação e IA podem impulsionar seu
                negócio para o próximo nível.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() =>
                    document
                      .querySelector("#contato")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan to-green-glow text-neural-deep font-semibold hover:shadow-xl hover:shadow-cyan/25 transition-all duration-300 hover:scale-105"
                >
                  Solicite uma demonstração
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
