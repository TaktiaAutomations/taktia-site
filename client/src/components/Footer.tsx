/*
 * Design: Neural Network Organic Tech
 * Footer com links organizados, branding (sem newsletter)
 */

import TaktiaLogo from "@/components/TaktiaLogo";
import { Bot, Cpu, Mail, MapPin, Phone, Workflow } from "lucide-react";

export default function Footer() {
  const handleNav = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="relative border-t border-cyan/10">
      <div className="container py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <TaktiaLogo size="sm" />
            </div>
            <p className="text-sm text-foreground/40 leading-relaxed mb-6 max-w-xs">
              Combinando inteligência humana e tecnologia para transformar
              negócios através da automação inteligente.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold text-foreground/80 mb-4 uppercase tracking-wider">
              Navegação
            </h4>
            <ul className="space-y-3">
              {[
                { label: "Home", href: "#home" },
                { label: "Sobre Nós", href: "#sobre" },
                { label: "Serviços", href: "#servicos" },
                { label: "Cases", href: "#cases" },
                { label: "Contato", href: "#contato" },
              ].map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleNav(link.href)}
                    className="text-sm text-foreground/40 hover:text-cyan transition-colors duration-300"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold text-foreground/80 mb-4 uppercase tracking-wider">
              Serviços
            </h4>
            <ul className="space-y-3">
              {[
                { icon: Cpu, label: "Integração de Plataformas" },
                { icon: Bot, label: "Atendimento com IA" },
                { icon: Workflow, label: "Automação de Atividades" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon size={14} className="text-cyan/50" />
                  <span className="text-sm text-foreground/40">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-semibold text-foreground/80 mb-4 uppercase tracking-wider">
              Contato
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:taktia@taktia.com.br"
                  className="flex items-center gap-2 text-sm text-foreground/40 hover:text-cyan transition-colors"
                >
                  <Mail size={14} className="text-cyan/50" />
                  taktia@taktia.com.br
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5534998592724"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-foreground/40 hover:text-cyan transition-colors"
                >
                  <Phone size={14} className="text-cyan/50" />
                  (34) 99859-2724
                </a>
              </li>
              <li>
                <span className="flex items-center gap-2 text-sm text-foreground/40">
                  <MapPin size={14} className="text-cyan/50" />
                  Uberlândia, MG
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="neural-line w-full mt-12 mb-8" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-foreground/30">
            &copy; {new Date().getFullYear()} Taktia Automações. Todos os
            direitos reservados.
          </p>
          <div className="flex items-center gap-1 text-xs text-foreground/30">
            <span>Feito com</span>
            <span className="text-cyan">IA</span>
            <span>e dedicação humana</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
