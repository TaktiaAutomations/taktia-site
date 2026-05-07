/*
 * Design: Neural Network Organic Tech
 * Formulário de contato com glassmorphism, inputs estilizados
 * Integrado com backend para envio real
 */

import AnimatedSection from "@/components/AnimatedSection";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    service: "",
    message: "",
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          service: formData.service,
          message: formData.message,
        }),
      });

      if (response.ok) {
        toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
        setFormData({ name: "", email: "", phone: "", company: "", service: "", message: "" });
      } else {
        toast.error("Erro ao enviar mensagem. Tente novamente ou entre em contato por telefone.");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente ou entre em contato por telefone.");
    } finally {
      setSending(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const inputClass =
    "w-full px-5 py-3.5 rounded-xl bg-neural-mid/50 border border-cyan/10 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-cyan/40 focus:bg-neural-mid/70 transition-all duration-300 text-sm";

  return (
    <section id="contato" className="relative py-24 sm:py-32">
      <div className="neural-line w-full mb-20" />

      <div className="container">
        {/* Section Header */}
        <AnimatedSection className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[2px] bg-gradient-to-r from-cyan to-transparent" />
            <span className="text-sm font-semibold text-cyan uppercase tracking-widest">
              Entre em Contato
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight max-w-3xl">
            Vamos <span className="gradient-text">conversar</span>?
          </h2>
          <p className="text-lg text-foreground/50 mt-6 max-w-2xl">
            Estamos prontos para transformar sua operação com automação
            inteligente. Preencha o formulário ou entre em contato diretamente.
          </p>
        </AnimatedSection>

        <div className="grid lg:grid-cols-5 gap-12">
          {/* Form */}
          <AnimatedSection direction="left" className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 sm:p-10">
              <div className="grid sm:grid-cols-2 gap-5 mb-5">
                <input
                  type="text"
                  name="name"
                  placeholder="Nome"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
                <input
                  type="email"
                  name="email"
                  placeholder="E-mail"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Telefone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={inputClass}
                />
                <input
                  type="text"
                  name="company"
                  placeholder="Empresa"
                  value={formData.company}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <select
                name="service"
                value={formData.service}
                onChange={handleChange}
                className={`${inputClass} mb-5 appearance-none`}
              >
                <option value="">Selecione o serviço de interesse</option>
                <option value="integracao">Integração de Plataformas</option>
                <option value="ia">Atendimento com IA</option>
                <option value="automacao">Automação de Atividades</option>
                <option value="outro">Outro Assunto</option>
              </select>

              <textarea
                name="message"
                placeholder="Mensagem"
                value={formData.message}
                onChange={handleChange}
                rows={5}
                className={`${inputClass} mb-6 resize-none`}
              />

              <motion.button
                type="submit"
                disabled={sending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan to-green-glow text-neural-deep font-semibold hover:shadow-xl hover:shadow-cyan/25 transition-all duration-300 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-neural-deep/30 border-t-neural-deep rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Enviar Mensagem
                  </>
                )}
              </motion.button>
            </form>
          </AnimatedSection>

          {/* Contact Info */}
          <AnimatedSection direction="right" delay={0.2} className="lg:col-span-2">
            <div className="space-y-6">
              {[
                {
                  icon: Mail,
                  title: "E-mail",
                  value: "taktia@taktia.com.br",
                  href: "mailto:taktia@taktia.com.br",
                },
                {
                  icon: Phone,
                  title: "Telefone / WhatsApp",
                  value: "(34) 99859-2724",
                  href: "https://wa.me/5534998592724",
                },
                {
                  icon: MapPin,
                  title: "Localização",
                  value: "Uberlândia, MG - Brasil",
                  href: "https://maps.google.com/?q=Uberlândia+MG",
                },
              ].map(({ icon: Icon, title, value, href }) => (
                <a
                  key={title}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="glass-card rounded-2xl p-6 flex items-start gap-4 group block hover:border-cyan/30"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan/20 to-green-glow/10 flex items-center justify-center shrink-0 group-hover:from-cyan/30 group-hover:to-green-glow/20 transition-all">
                    <Icon size={20} className="text-cyan" />
                  </div>
                  <div>
                    <div className="text-sm text-foreground/40 mb-1">{title}</div>
                    <div className="text-foreground/80 font-medium">{value}</div>
                  </div>
                </a>
              ))}

              {/* AI Badge */}
              <div className="glass-card rounded-2xl p-6 border-green-glow/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full bg-green-glow animate-pulse" />
                  <span className="text-sm font-semibold text-green-glow">
                    IA Disponível 24/7
                  </span>
                </div>
                <p className="text-sm text-foreground/50 leading-relaxed">
                  Nosso assistente virtual está sempre disponível para tirar
                  dúvidas rápidas e direcionar você ao especialista certo.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
