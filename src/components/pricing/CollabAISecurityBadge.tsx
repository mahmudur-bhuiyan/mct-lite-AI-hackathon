import { Shield, Lock, Server, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CollabAISecurityBadge() {
  return (
    <section className="py-16 bg-gradient-to-r from-mortgage-navy to-mortgage-navy/95">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <a 
            href="https://collabai.software/industry/mortgage" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 hover:bg-white/20 transition-colors group"
          >
            <Shield className="w-5 h-5 text-mortgage-teal" />
            <span className="text-white font-medium">Powered by CollabAI Security</span>
            <ExternalLink className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </a>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Your Data Never Leaves Your Infrastructure
          </h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Mortgage Control Tower is built on CollabAI's secure infrastructure. 
            All AI processing happens behind your firewall, ensuring complete data sovereignty.
          </p>
        </div>
        
        {/* Security Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-mortgage-teal/20 mb-4">
              <Lock className="w-6 h-6 text-mortgage-teal" />
            </div>
            <h3 className="text-white font-semibold mb-2">End-to-End Encryption</h3>
            <p className="text-white/70 text-sm">
              AES-256 encryption for data at rest and TLS 1.3 for data in transit
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-mortgage-teal/20 mb-4">
              <Server className="w-6 h-6 text-mortgage-teal" />
            </div>
            <h3 className="text-white font-semibold mb-2">On-Premise Option</h3>
            <p className="text-white/70 text-sm">
              Deploy entirely within your infrastructure for maximum control
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-mortgage-teal/20 mb-4">
              <Shield className="w-6 h-6 text-mortgage-teal" />
            </div>
            <h3 className="text-white font-semibold mb-2">SOC 2 Type II</h3>
            <p className="text-white/70 text-sm">
              Independently audited security controls and compliance
            </p>
          </div>
        </div>
        
        {/* Compliance Badges */}
        <div className="flex flex-wrap justify-center gap-6 mb-10">
          {["FINRA", "HIPAA", "GDPR", "SOC 2", "ISO 27001"].map((badge) => (
            <div 
              key={badge}
              className="flex items-center gap-2 bg-white/5 border border-white/20 rounded-lg px-4 py-2"
            >
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-white font-medium text-sm">{badge}</span>
            </div>
          ))}
        </div>

        {/* CTA to CollabAI Platform */}
        <div className="text-center">
          <Button
            size="lg"
            className="bg-white text-mortgage-navy hover:bg-white/90 rounded-full px-8 py-6 text-base font-semibold shadow-lg"
            asChild
          >
            <a href="https://collabai.software/industry/mortgage" target="_blank" rel="noopener noreferrer">
              Explore the Full CollabAI Platform
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
