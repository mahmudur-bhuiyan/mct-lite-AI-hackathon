import {
  Building2,
  Home,
  CreditCard,
  Briefcase,
  MapPin,
  Cpu,
  Share2,
  LineChart,
  ClipboardList,
  Droplets,
  FileText,
  Umbrella,
  Video,
  MonitorSmartphone,
  MailWarning,
} from "lucide-react";
import {
  DataFeedIntegrationCard,
  DataFeedIntegrationCardSkeleton,
  type DataFeedMeta,
} from "./DataFeedIntegrationCard";

const INTEGRATIONS: DataFeedMeta[] = [
  {
    provider: "freddie-mac",
    name: "Freddie Mac",
    description:
      "Mortgage rates, loan purchasing guidelines, and related data from your Freddie Mac–approved feed or aggregator.",
    icon: <Home className="h-5 w-5 text-blue-600" />,
    accentColor: "bg-blue-600",
    category: "GSE / Mortgage Rates",
  },
  {
    provider: "fannie-mae",
    name: "Fannie Mae",
    description:
      "Lending guidelines, underwriting requirements, and conforming limits from your Fannie Mae–connected data source.",
    icon: <Building2 className="h-5 w-5 text-indigo-600" />,
    accentColor: "bg-indigo-600",
    category: "GSE / Lending Guidelines",
  },
  {
    provider: "credit-bureau",
    name: "Credit Bureau",
    description:
      "Tri-merge credit reporting integration (Equifax, Experian, TransUnion) via your credit vendor or reseller API.",
    icon: <CreditCard className="h-5 w-5 text-rose-600" />,
    accentColor: "bg-rose-600",
    category: "Credit Reporting",
  },
  {
    provider: "voe-provider",
    name: "VOE / VOI Provider",
    description:
      "Employment and income verification via The Work Number, Plaid, or other verification vendor. When disabled, users can still enter data manually.",
    icon: <Briefcase className="h-5 w-5 text-amber-600" />,
    accentColor: "bg-amber-600",
    category: "Employment Verification",
  },
  {
    provider: "avm-provider",
    name: "AVM Provider",
    description:
      "Automated property valuation model via ClearCapital, HouseCanary, CoreLogic, or similar vendor. When disabled, users can still enter valuations manually.",
    icon: <MapPin className="h-5 w-5 text-emerald-600" />,
    accentColor: "bg-emerald-600",
    category: "Property Valuation",
  },
  {
    provider: "aus-fannie-du",
    name: "Fannie Mae — Desktop Underwriter (DU)",
    description:
      "Store credentials for automated underwriting. When disabled, staff can still record manual AUS outcomes. Live DU requires your vendor contract.",
    icon: <Cpu className="h-5 w-5 text-violet-600" />,
    accentColor: "bg-violet-600",
    category: "Automated Underwriting",
  },
  {
    provider: "aus-freddie-lp",
    name: "Freddie Mac — Loan Product Advisor (LPA)",
    description:
      "Store credentials for LPA submissions. Stub mode records requests until your integration is enabled.",
    icon: <Cpu className="h-5 w-5 text-sky-600" />,
    accentColor: "bg-sky-600",
    category: "Automated Underwriting",
  },
  {
    provider: "investor-tpo-connector",
    name: "Investor / TPO delivery (stub)",
    description:
      "Optional wholesale investor connector. Off by default — manual investor submission workflow works without it.",
    icon: <Share2 className="h-5 w-5 text-orange-600" />,
    accentColor: "bg-orange-600",
    category: "Secondary / Investor",
  },
  {
    provider: "hedge-data-vendor",
    name: "Hedge data vendor (stub)",
    description:
      "Placeholder for external marks or curves. Hedge snapshots on the pricing module use manual compute from locks.",
    icon: <LineChart className="h-5 w-5 text-slate-600" />,
    accentColor: "bg-slate-600",
    category: "Secondary / Hedge",
  },
  {
    provider: "appraisal-amc-stub",
    name: "Appraisal / AMC (stub)",
    description:
      "Optional appraisal order integration. Off by default — order and status are tracked manually on each loan.",
    icon: <ClipboardList className="h-5 w-5 text-teal-600" />,
    accentColor: "bg-teal-600",
    category: "Closing — Property",
  },
  {
    provider: "flood-cert-vendor-stub",
    name: "Flood certification (stub)",
    description: "Optional flood determination vendor. Manual flood order rows remain the source of truth until enabled.",
    icon: <Droplets className="h-5 w-5 text-cyan-600" />,
    accentColor: "bg-cyan-600",
    category: "Closing — Settlement",
  },
  {
    provider: "title-vendor-stub",
    name: "Title / settlement (stub)",
    description: "Optional title plant or closing agent API. Track title orders manually when this is off.",
    icon: <FileText className="h-5 w-5 text-stone-600" />,
    accentColor: "bg-stone-600",
    category: "Closing — Settlement",
  },
  {
    provider: "homeowners-insurance-vendor-stub",
    name: "HOI tracking vendor (stub)",
    description: "Optional homeowners insurance proof-of-insurance workflow. Manual HOI orders still apply.",
    icon: <Umbrella className="h-5 w-5 text-pink-600" />,
    accentColor: "bg-pink-600",
    category: "Closing — Settlement",
  },
  {
    provider: "ron-provider-stub",
    name: "Remote online notary — RON (stub)",
    description: "Optional RON session provider. Schedule and complete notarizations manually until connected.",
    icon: <Video className="h-5 w-5 text-violet-700" />,
    accentColor: "bg-violet-700",
    category: "Closing — Digital",
  },
  {
    provider: "eclose-platform-stub",
    name: "eClose / eNote platform (stub)",
    description:
      "Placeholder for a full eClosing stack. DocuSign disclosures stay separate; this hook is for future eNote registry flows.",
    icon: <MonitorSmartphone className="h-5 w-5 text-indigo-700" />,
    accentColor: "bg-indigo-700",
    category: "Closing — Digital",
  },
  {
    provider: "adverse-action-notice-stub",
    name: "Adverse action notices (stub)",
    description:
      "Optional vendor for generating and delivering adverse action notices. Manual letter builder on the loan still works without it.",
    icon: <MailWarning className="h-5 w-5 text-red-700" />,
    accentColor: "bg-red-700",
    category: "Compliance / Adverse action",
  },
];

interface IntegrationsGridProps {
  isLoading?: boolean;
}

export function IntegrationsGrid({ isLoading = false }: IntegrationsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <DataFeedIntegrationCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {INTEGRATIONS.map((meta) => (
        <DataFeedIntegrationCard key={meta.provider} meta={meta} />
      ))}
    </div>
  );
}
