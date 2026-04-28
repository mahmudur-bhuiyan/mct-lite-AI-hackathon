import { Eye, Mail, FileSearch } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const valueProps = [
  {
    icon: Eye,
    title: "Manager-First Visibility",
    description:
      "See what matters. Pipeline health, processor workloads, at-risk loans, and approaching deadlines—all in one view. No digging required.",
    highlights: ["Real-time pipeline view", "Processor workload dashboard", "Risk-sorted loan list"],
    color: "primary",
    bgColor: "bg-mortgage-teal-light",
    borderColor: "border-primary/20",
  },
  {
    icon: Mail,
    title: "Email Intelligence",
    description:
      "Your inbox, understood. AI reads emails, extracts action items, links to loans, and drafts replies. Approve and send—or edit first.",
    highlights: ["Auto-extract action items", "Link emails to loans", "AI-drafted replies"],
    color: "accent",
    bgColor: "bg-mortgage-gold-light",
    borderColor: "border-accent/20",
  },
  {
    icon: FileSearch,
    title: "Document AI",
    description:
      "Documents read themselves. Dual-provider AI (Landing AI + Google) extracts income, assets, and flags fraud automatically.",
    highlights: ["Paystubs & W-2 extraction", "Bank statement analysis", "Fraud detection"],
    color: "success",
    bgColor: "bg-mortgage-green-light",
    borderColor: "border-success/20",
  },
];

const colorMap = {
  primary: {
    icon: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  accent: {
    icon: "text-accent",
    badge: "bg-accent/10 text-accent border-accent/20",
  },
  success: {
    icon: "text-success",
    badge: "bg-success/10 text-success border-success/20",
  },
};

export function ValueProps() {
  return (
    <section className="border-y border-border/50 bg-card">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for <span className="text-primary">Operations Managers</span>, Not Loan Officers
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Mortgage Control Tower doesn't replace your LOS or CRM. It sits on top, giving you the visibility 
            those systems don't provide.
          </p>
        </div>

        {/* Value Proposition Cards */}
        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
          {valueProps.map((prop) => {
            const colors = colorMap[prop.color as keyof typeof colorMap];
            return (
              <Card 
                key={prop.title} 
                className={`relative overflow-hidden ${prop.bgColor} ${prop.borderColor} border-2 transition-all hover:shadow-lg hover:-translate-y-1`}
              >
                <CardHeader>
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-card shadow-sm ${prop.borderColor} border`}>
                    <prop.icon className={`h-7 w-7 ${colors.icon}`} />
                  </div>
                  <CardTitle className="text-xl text-foreground">{prop.title}</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {prop.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {prop.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${colors.badge}`}
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
