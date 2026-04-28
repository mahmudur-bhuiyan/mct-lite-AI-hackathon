import { 
  Eye, 
  AlertTriangle, 
  Clock, 
  Users, 
  Brain, 
  Link2, 
  Bell,
  Mail,
  FileSearch,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Eye,
    title: "Real-Time Pipeline View",
    description: "See every loan's status across all systems in one unified dashboard. Filter by risk, stage, processor, or deadline.",
    badge: "Core",
    badgeVariant: "secondary" as const,
    color: "primary",
  },
  {
    icon: AlertTriangle,
    title: "AI Risk Detection",
    description: "Machine learning identifies loans likely to miss milestones based on historical patterns and current trajectory.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "primary",
  },
  {
    icon: Clock,
    title: "Lock Expiration Alerts",
    description: "Never miss a rate lock again. Automated alerts at 7, 3, and 1 day before expiration with one-click extensions.",
    badge: "Core",
    badgeVariant: "secondary" as const,
    color: "accent",
  },
  {
    icon: Users,
    title: "Processor Workload View",
    description: "Balance your team's capacity. See each processor's active loans, pending conditions, and bottlenecks.",
    badge: "Core",
    badgeVariant: "secondary" as const,
    color: "primary",
  },
  {
    icon: Brain,
    title: "Smart Prioritization",
    description: "AI ranks today's most critical loans so your team knows exactly what to work on first every morning.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "primary",
  },
  {
    icon: Link2,
    title: "LOS & CRM Integration",
    description: "Connects to Encompass, Byte, and major CRMs. No double entry—data flows automatically.",
    badge: "Integration",
    badgeVariant: "outline" as const,
    color: "accent",
  },
  {
    icon: Mail,
    title: "Email Intelligence Agent",
    description: "AI reads your inbox, extracts action items, links emails to loans, and drafts replies for your approval.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "primary",
  },
  {
    icon: FileSearch,
    title: "Document Reading Agent",
    description: "Dual-provider AI (Landing AI + Google) extracts data from paystubs, W-2s, bank statements. Flags fraud automatically.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "success",
  },
  {
    icon: MessageSquare,
    title: "Communication Center",
    description: "Generate loan-related document drafts and borrower-facing updates from live data. Human approval before sending.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "primary",
  },
  {
    icon: Bell,
    title: "Condition Tracking",
    description: "Monitor outstanding conditions across all loans. Automatic reminders to borrowers and internal escalation.",
    badge: "Core",
    badgeVariant: "secondary" as const,
    color: "accent",
  },
];

const badgeStyles = {
  default: "bg-gradient-to-r from-primary to-secondary text-primary-foreground border-0",
  secondary: "bg-secondary text-secondary-foreground border-0",
  outline: "bg-mortgage-gold-light text-accent border-accent/30",
};

const iconBgColors = {
  primary: "bg-mortgage-teal-light border-primary/20",
  accent: "bg-mortgage-gold-light border-accent/20",
  success: "bg-mortgage-green-light border-success/20",
};

const iconColors = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
};

export function FeatureGrid() {
  return (
    <section className="bg-gradient-to-b from-mortgage-cream to-background">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything You Need to <span className="text-primary">Manage Smarter</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Purpose-built features for mortgage operations teams. No bloat, no complexity—just 
            the visibility you've been asking for.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card 
              key={feature.title} 
              className="group relative overflow-hidden border-border/50 bg-card transition-all hover:shadow-lg hover:border-primary/30"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${iconBgColors[feature.color as keyof typeof iconBgColors]}`}>
                    <feature.icon className={`h-6 w-6 ${iconColors[feature.color as keyof typeof iconColors]}`} />
                  </div>
                  <Badge 
                    variant={feature.badgeVariant}
                    className={`text-xs ${badgeStyles[feature.badgeVariant]}`}
                  >
                    {feature.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-4 text-foreground group-hover:text-primary transition-colors">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
