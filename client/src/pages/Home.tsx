import Chatbot from "@/components/Chatbot";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import NeuralBackground from "@/components/NeuralBackground";
import AboutSection from "@/components/sections/AboutSection";
import AIFeaturesSection from "@/components/sections/AIFeaturesSection";
import CasesSection from "@/components/sections/CasesSection";
import ContactSection from "@/components/sections/ContactSection";
import CTASection from "@/components/sections/CTASection";
import DifferentialsSection from "@/components/sections/DifferentialsSection";
import HeroSection from "@/components/sections/HeroSection";
import ServicesSection from "@/components/sections/ServicesSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-neural-deep text-foreground overflow-x-hidden">
      <NeuralBackground />
      <Navbar />
      <main className="relative z-10">
        <HeroSection />
        <AboutSection />
        <ServicesSection />
        <AIFeaturesSection />
        <DifferentialsSection />
        <CasesSection />
        <CTASection />
        <ContactSection />
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
}
