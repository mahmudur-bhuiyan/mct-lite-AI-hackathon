import { Link } from "react-router-dom";
import { Building2, Linkedin, Twitter, ExternalLink } from "lucide-react";

const product = [
  { name: "Features", href: "#features" },
  { name: "Integrations", href: "https://collabai.software/integrations", isExternal: true },
  { name: "Book a Demo", href: "https://collabai.software/try-demo", isExternal: true },
];

const industries = [
  { name: "Mortgage", href: "https://collabai.software/industry/mortgage", isExternal: true },
  { name: "Banking", href: "https://collabai.software/banking", isExternal: true },
  { name: "Healthcare", href: "https://collabai.software/healthcare", isExternal: true },
  { name: "Accounting", href: "https://collabai.software/accounting", isExternal: true },
  { name: "Legal", href: "https://collabai.software/legal", isExternal: true },
];

const company = [
  { name: "About CollabAI", href: "https://collabai.software", isExternal: true },
  { name: "Contact Sales", href: "https://collabai.software/contact", isExternal: true },
  { name: "Documentation", href: "/knowledge", isRoute: true },
  { name: "Support", href: "/feedback", isRoute: true },
];

const legal = [
  { name: "Privacy Policy", href: "https://collabai.software/privacy", isExternal: true },
  { name: "Security", href: "https://collabai.software/security", isExternal: true },
  { name: "Terms of Service", href: "https://collabai.software/terms", isExternal: true },
];

export function Footer() {
  const renderLink = (item: { name: string; href: string; isRoute?: boolean; isExternal?: boolean }) => {
    if (item.isExternal) {
      return (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors inline-flex items-center gap-1"
        >
          {item.name}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    if (item.isRoute) {
      return (
        <Link
          to={item.href}
          className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
        >
          {item.name}
        </Link>
      );
    }
    return (
      <a
        href={item.href}
        className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
      >
        {item.name}
      </a>
    );
  };

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand Column */}
          <div className="col-span-2">
            <a 
              href="https://collabai.software/industry/mortgage" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 mb-4 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary group-hover:bg-primary/90 transition-colors">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg">MCT</span>
                <span className="text-xs text-secondary-foreground/50">by CollabAI</span>
              </div>
            </a>
            <p className="text-sm text-secondary-foreground/70 leading-relaxed mb-4">
              The AI-powered command center for mortgage operations teams.
              Part of the CollabAI Agentic Workforce.
            </p>
            {/* Social Links */}
            <div className="flex gap-4">
              <a 
                href="https://linkedin.com/company/collabai" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-foreground/10 hover:bg-primary transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a 
                href="https://twitter.com/collabai" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-foreground/10 hover:bg-primary transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide mb-4 text-primary">Product</h3>
            <ul className="space-y-3">
              {product.map((item) => (
                <li key={item.name}>{renderLink(item)}</li>
              ))}
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide mb-4 text-primary">Industries</h3>
            <ul className="space-y-3">
              {industries.map((item) => (
                <li key={item.name}>{renderLink(item)}</li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide mb-4 text-primary">Company</h3>
            <ul className="space-y-3">
              {company.map((item) => (
                <li key={item.name}>{renderLink(item)}</li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide mb-4 text-primary">Legal</h3>
            <ul className="space-y-3">
              {legal.map((item) => (
                <li key={item.name}>{renderLink(item)}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-secondary-foreground/10 pt-8 md:flex-row">
          <p className="text-sm text-secondary-foreground/50">
            © {new Date().getFullYear()} CollabAI. Mortgage Control Tower is a CollabAI product.
          </p>
          <a 
            href="https://collabai.software/industry/mortgage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-secondary-foreground/50 hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            Explore the full CollabAI Agentic Workforce
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </footer>
  );
}
