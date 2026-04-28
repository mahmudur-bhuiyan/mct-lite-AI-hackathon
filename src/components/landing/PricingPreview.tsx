import { Check, X, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

const comparisonData = [
  {
    feature: "Real-time pipeline view",
    spreadsheets: "Manual",
    losReports: "Limited",
    mct: "Live"
  },
  {
    feature: "AI risk detection",
    spreadsheets: false,
    losReports: false,
    mct: true
  },
  {
    feature: "Cross-system timeline",
    spreadsheets: false,
    losReports: false,
    mct: true
  },
  {
    feature: "Workload visibility",
    spreadsheets: "Manual",
    losReports: false,
    mct: true
  },
  {
    feature: "Email action extraction",
    spreadsheets: "Manual",
    losReports: false,
    mct: "AI-powered"
  },
  {
    feature: "Document data extraction",
    spreadsheets: "Manual",
    losReports: "Partial",
    mct: "Dual-AI"
  },
  {
    feature: "Fraud detection",
    spreadsheets: false,
    losReports: false,
    mct: "Automatic"
  },
  {
    feature: "Lock expiry alerts",
    spreadsheets: "Manual",
    losReports: "Limited",
    mct: true
  },
  {
    feature: "Condition tracking",
    spreadsheets: "Manual",
    losReports: "Limited",
    mct: true
  },
  {
    feature: "Daily action prioritization",
    spreadsheets: false,
    losReports: false,
    mct: true
  },
  {
    feature: "Manager insights (NL queries)",
    spreadsheets: false,
    losReports: false,
    mct: true
  }
];

function CellValue({ value, isMct = false }: { value: boolean | string; isMct?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className={`h-5 w-5 ${isMct ? 'text-success' : 'text-primary'}`} />
    ) : (
      <X className="h-5 w-5 text-destructive/50" />
    );
  }
  if (value === "Manual" || value === "Limited" || value === "Partial") {
    return (
      <span className="inline-flex items-center rounded-full bg-mortgage-gold-light px-2 py-0.5 text-xs text-accent font-medium">
        {value}
      </span>
    );
  }
  if (value === "Live" || value === "AI-powered" || value === "Dual-AI" || value === "Automatic") {
    return (
      <span className="inline-flex items-center rounded-full bg-mortgage-green-light px-2 py-0.5 text-xs text-success font-medium">
        {value}
      </span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export function PricingPreview() {
  return (
    <section className="border-y border-border/50 bg-card">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Compare Your <span className="text-primary">Options</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See how Mortgage Control Tower stacks up against the tools you're currently using to manage 
            your mortgage pipeline.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-xl border-2 border-primary/20 bg-card shadow-lg">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-4 border-b border-border p-4 text-sm font-semibold">
            <div className="text-foreground">Feature</div>
            <div className="text-center text-muted-foreground">Spreadsheets</div>
            <div className="text-center text-muted-foreground">LOS Reports</div>
            <div className="text-center">
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-primary to-secondary px-3 py-1 text-primary-foreground">
                MCT
              </span>
            </div>
          </div>

          {/* Table Body */}
          {comparisonData.map((row, index) => (
            <div
              key={index}
              className={`grid grid-cols-4 gap-4 border-b border-border/50 p-4 last:border-0 ${
                index % 2 === 0 ? 'bg-muted/30' : ''
              }`}
            >
              <div className="text-sm font-medium text-foreground">{row.feature}</div>
              <div className="flex items-center justify-center text-muted-foreground">
                <CellValue value={row.spreadsheets} />
              </div>
              <div className="flex items-center justify-center text-muted-foreground">
                <CellValue value={row.losReports} />
              </div>
              <div className="flex items-center justify-center font-medium text-foreground bg-mortgage-teal-light/50 rounded-lg py-2">
                <CellValue value={row.mct} isMct />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-6">
            Ready to see Mortgage Control Tower in action? Get a personalized demo for your team.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="h-14 rounded-full px-10 text-base font-semibold shadow-lg bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              Request a Demo
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="h-14 rounded-full px-10 text-base font-semibold border-2 border-primary hover:bg-primary/5"
              onClick={() => window.open("https://collabai.software/try-demo", "_blank", "noopener,noreferrer")}
            >
              See Product Overview
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
