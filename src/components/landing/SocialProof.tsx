import { Card, CardContent } from "@/components/ui/card";
import { Quote, TrendingUp, Clock, AlertTriangle, DollarSign } from "lucide-react";

const stats = [
  {
    icon: TrendingUp,
    value: "23%",
    label: "Faster close times",
    color: "text-primary",
    bgColor: "bg-mortgage-teal-light",
  },
  {
    icon: AlertTriangle,
    value: "67%",
    label: "Fewer at-risk loans",
    color: "text-success",
    bgColor: "bg-mortgage-green-light",
  },
  {
    icon: Clock,
    value: "4hrs",
    label: "Saved per manager/week",
    color: "text-accent",
    bgColor: "bg-mortgage-gold-light",
  },
  {
    icon: DollarSign,
    value: "$2.4M",
    label: "Saved in rate lock extensions",
    color: "text-success",
    bgColor: "bg-mortgage-green-light",
  },
];

const testimonials = [
  {
    quote: "I used to spend the first two hours of every day just figuring out which loans needed attention. Now I know before I finish my coffee.",
    author: "Sarah M.",
    role: "Operations Manager, Regional Lender",
    metric: "2 hours saved daily",
    metricColor: "text-accent",
  },
  {
    quote: "We caught three loans about to miss lock expirations in the first week. That alone paid for a year of the software.",
    author: "Michael R.",
    role: "VP of Operations, Mortgage Broker",
    metric: "$180K saved",
    metricColor: "text-success",
  },
  {
    quote: "Finally, a tool that shows me what I actually need to see without making me dig through five different systems.",
    author: "Jennifer L.",
    role: "Branch Manager, Credit Union",
    metric: "5 systems unified",
    metricColor: "text-primary",
  },
];

export function SocialProof() {
  return (
    <section className="bg-gradient-to-b from-background to-mortgage-cream">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Trusted by <span className="text-primary">Mortgage Teams</span> Like Yours
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Operations managers are already using Mortgage Control Tower to stay ahead of their pipeline.
          </p>
        </div>

        {/* Testimonials */}
        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="relative overflow-hidden border-2 border-primary/10 bg-card hover:border-primary/30 transition-all"
            >
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-success" />
              
              <CardContent className="p-6">
                <Quote className="h-8 w-8 text-primary/30 mb-4" />
                <p className="text-foreground leading-relaxed mb-6 italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                  <span className={`text-sm font-bold ${testimonial.metricColor}`}>
                    {testimonial.metric}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center rounded-xl ${stat.bgColor} border border-border/50 p-6 text-center transition-all hover:shadow-md`}
            >
              <stat.icon className={`h-8 w-8 ${stat.color} mb-3`} />
              <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="mt-1 text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
