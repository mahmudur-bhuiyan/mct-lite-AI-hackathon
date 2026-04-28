import { Check, X } from "lucide-react";

const comparisons = [
  {
    oldWay: "Logging into 3+ systems to check pipeline status",
    newWay: "One dashboard shows every loan's real-time status",
  },
  {
    oldWay: "Discovering problems after borrowers complain",
    newWay: "AI flags at-risk loans before they fall behind",
  },
  {
    oldWay: "Manually tracking rate lock expirations in spreadsheets",
    newWay: "Automatic alerts 7, 3, and 1 day before expiry",
  },
  {
    oldWay: "Reading every email to find action items",
    newWay: "AI extracts tasks from emails automatically",
  },
  {
    oldWay: "Manually entering data from paystubs and W-2s",
    newWay: "AI reads documents and extracts income data",
  },
  {
    oldWay: "Inconsistent document math verification",
    newWay: "AI detects fraud and calculation errors automatically",
  },
  {
    oldWay: "Asking processors for loan updates one by one",
    newWay: "See processor workload and all loan statuses instantly",
  },
];

export function ProblemSolution() {
  return (
    <section className="bg-gradient-to-b from-background to-mortgage-cream">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Stop Managing by <span className="text-destructive">Firefighting</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Most mortgage managers don't know a loan is in trouble until it's already behind. 
            <span className="font-medium text-foreground"> Mortgage Control Tower</span> changes that.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {/* Headers */}
            <div className="hidden md:block rounded-xl bg-mortgage-red-light border border-destructive/20 p-4 text-center">
              <span className="text-sm font-semibold text-destructive uppercase tracking-wide">
                ❌ The Old Way
              </span>
            </div>
            <div className="hidden md:block rounded-xl bg-mortgage-green-light border border-success/20 p-4 text-center">
              <span className="text-sm font-semibold text-success uppercase tracking-wide">
                ✓ With Mortgage Control Tower
              </span>
            </div>

            {/* Comparison Rows */}
            {comparisons.map((item, index) => (
              <>
                {/* Old Way - Red tinted */}
                <div
                  key={`old-${index}`}
                  className="flex items-start gap-3 rounded-xl bg-mortgage-red-light/50 border border-destructive/10 p-4 md:p-5"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/20">
                    <X className="h-4 w-4 text-destructive" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.oldWay}</p>
                </div>

                {/* New Way - Green tinted */}
                <div
                  key={`new-${index}`}
                  className="flex items-start gap-3 rounded-xl bg-mortgage-green-light/50 border border-success/10 p-4 md:p-5"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/20">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-sm text-foreground font-medium leading-relaxed">{item.newWay}</p>
                </div>
              </>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
