import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { 
  PricingHero, 
  PricingCards, 
  AgenticWorkforceList, 
  ROICalculator, 
  CollabAISecurityBadge 
} from "@/components/pricing";
import { Footer } from "@/components/landing/Footer";
import collabaiLogo from "@/assets/collabai-logo.png";

export default function Pricing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/pricing-public" },
    { label: "Security", href: "https://collabai.software/security", external: true },
    { label: "Contact", href: "https://collabai.software/contact", external: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img src={collabaiLogo} alt="CollabAI" className="h-10 w-auto" />
            <span className="hidden sm:block font-semibold text-foreground text-lg">
              Mortgage Control Tower
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground hover:text-mortgage-teal transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-mortgage-teal after:transition-all hover:after:w-full"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-mortgage-teal transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-mortgage-teal after:transition-all hover:after:w-full"
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button 
              size="sm" 
              className="rounded-full bg-gradient-to-r from-mortgage-teal to-mortgage-teal/90 hover:from-mortgage-teal/90 hover:to-mortgage-teal/80 text-white shadow-md"
              asChild
            >
              <a href="https://collabai.software/try-demo" target="_blank" rel="noopener noreferrer">
                Book a Demo
              </a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-6 py-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-muted-foreground hover:text-mortgage-teal"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-mortgage-teal"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button 
                  size="sm" 
                  className="rounded-full bg-gradient-to-r from-mortgage-teal to-mortgage-teal/90 text-white"
                  asChild
                >
                  <a href="https://collabai.software/try-demo" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        <PricingHero />
        <PricingCards />
        <AgenticWorkforceList />
        <ROICalculator />
        <CollabAISecurityBadge />
      </main>

      <Footer />
    </div>
  );
}
