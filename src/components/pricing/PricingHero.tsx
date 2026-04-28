import { Badge } from "@/components/ui/badge";
import { Shield, Lock, CheckCircle, ExternalLink } from "lucide-react";

export function PricingHero() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-mortgage-cream via-white to-mortgage-teal/5" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-mortgage-teal/10 to-transparent" />
      
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* CollabAI Badge - Clickable */}
          <a 
            href="https://collabai.software/industry/mortgage" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block mb-6 group"
          >
            <Badge className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 px-4 py-2 text-sm group-hover:from-blue-700 group-hover:to-blue-800 transition-all cursor-pointer">
              <Shield className="w-4 h-4 mr-2" />
              Powered by CollabAI Security
              <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
            </Badge>
          </a>
          
          {/* Main Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-mortgage-navy mb-6">
            Extend Your{" "}
            <span className="bg-gradient-to-r from-mortgage-teal to-mortgage-teal/80 bg-clip-text text-transparent">
              Agentic Workforce
            </span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            The visual command center for your CollabAI-powered mortgage operations. 
            <span className="text-mortgage-teal font-semibold"> 10 specialized AI agents</span>. 
            One unified dashboard. Hours saved every week.
          </p>
          
          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <Lock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Behind Your Firewall</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-sm font-medium">FINRA Compliant</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-sm font-medium">HIPAA Ready</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-sm font-medium">GDPR Compliant</span>
            </div>
          </div>
          
          {/* Positioning Statement */}
          <div className="bg-gradient-to-r from-mortgage-navy/5 to-mortgage-teal/5 rounded-2xl p-6 border border-border/50 max-w-2xl mx-auto">
            <p className="text-muted-foreground italic mb-4">
              "CollabAI provides the secure AI backbone. Mortgage Control Tower gives you the eyes. 
              Together, they transform your mortgage operation from reactive to <span className="text-mortgage-teal font-semibold">proactive</span>."
            </p>
            <a 
              href="https://collabai.software/industry/mortgage" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
            >
              Learn more about CollabAI for Mortgage
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
