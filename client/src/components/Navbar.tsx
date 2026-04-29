import TaktiaLogo from "@/components/TaktiaLogo";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Sobre Nós", href: "#sobre" },
  { label: "Serviços", href: "#servicos" },
  { label: "Diferenciais", href: "#diferenciais" },
  { label: "Cases", href: "#cases" },
  { label: "Contato", href: "#contato" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  const handleClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-neural-deep/80 backdrop-blur-xl border-b border-cyan/10 shadow-lg shadow-cyan/5"
          : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <nav className="container flex items-center justify-between h-20">
        {/* Logo */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            handleClick("#home");
          }}
          className="flex items-center group"
        >
          <TaktiaLogo size="md" />
        </a>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                handleClick(link.href);
              }}
              className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-cyan transition-colors duration-300 relative group"
            >
              {link.label}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-cyan to-green-glow group-hover:w-3/4 transition-all duration-300" />
            </a>
          ))}
        </div>

        {/* CTA Button */}
        <a
          href="#contato"
          onClick={(e) => {
            e.preventDefault();
            handleClick("#contato");
          }}
          className="hidden lg:inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan to-green-glow text-neural-deep font-semibold text-sm hover:shadow-lg hover:shadow-cyan/25 transition-all duration-300 hover:scale-105"
        >
          Solicitar Orçamento
        </a>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 text-foreground/70 hover:text-cyan transition-colors"
          aria-label="Menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={mobileOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        className="lg:hidden overflow-hidden bg-neural-deep/95 backdrop-blur-xl border-b border-cyan/10"
      >
        <div className="container py-4 flex flex-col gap-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                handleClick(link.href);
              }}
              className="px-4 py-3 text-sm font-medium text-foreground/70 hover:text-cyan hover:bg-cyan/5 rounded-lg transition-all duration-300"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contato"
            onClick={(e) => {
              e.preventDefault();
              handleClick("#contato");
            }}
            className="mt-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan to-green-glow text-neural-deep font-semibold text-sm text-center"
          >
            Solicitar Orçamento
          </a>
        </div>
      </motion.div>
    </motion.header>
  );
}
