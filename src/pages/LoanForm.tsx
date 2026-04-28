import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoan, useCreateLoan, useUpdateLoan, useLoanProducts, useLoanPrograms } from "@/hooks/useLoans";
import { useBorrowers } from "@/hooks/useBorrowers";
import { useAuth } from "@/contexts/AuthContext";
import { useZipcodeAutofill } from "@/hooks/useZipcodeAutofill";
import { useUSCountiesByState, useUSCitiesByStateCounty, lookupCountyByCity, US_STATES } from "@/hooks/useUSLocationOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PIPELINE_STAGE_SELECT_OPTIONS } from "@/lib/loan-pipeline-stages";
import { normalizeRoleString } from "@/lib/agentRoles";

const loanFormSchema = z.object({
  loan_number: z.string().min(1, "Loan number is required"),
  borrower_id: z.string().uuid("Select a borrower"),
  branch_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  program_id: z.string().uuid().optional().nullable(),
  status: z.string().min(1),
  loan_amount: z.coerce.number().min(0).optional().nullable(),
  appraised_value: z.coerce.number().min(0).optional().nullable(),
  ltv: z.coerce.number().min(0).max(200).optional().nullable(),
  credit_score: z.coerce.number().min(0).max(850).optional().nullable(),
  dti: z.coerce.number().min(0).max(100).optional().nullable(),
  purpose: z.string().optional().nullable(),
  occupancy_type: z.string().optional().nullable(),
  property_address: z.string().optional().nullable(),
  property_city: z.string().optional().nullable(),
  property_state: z.string().optional().nullable(),
  property_postal_code: z.string().optional().nullable(),
  lock_date: z.string().optional().nullable(),
  lock_expiration_date: z.string().optional().nullable(),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

export default function LoanForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isEdit = !!id;
  const redirectToLoanDetail = isEdit && id ? `/loans/${id}` : "/loans";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      status: "draft",
      branch_id: null,
      product_id: null,
      program_id: null,
    },
  });

  const productId = watch("product_id");

  // ── Zipcode autofill ──────────────────────────────────────────────────────
  const { lookupByCityState, debounced, loading: zipcodeLoading } =
    useZipcodeAutofill();

  // Store the last values that were programmatically autofilled so each
  // effect can tell "this change came from autofill — skip" rather than
  // kicking off a new lookup and creating a cycle.
  const autofilled = useRef<{ city?: string; state?: string; zip?: string }>({});

  const cityValue = watch("property_city");
  const stateValue = watch("property_state");
  const zipValue = watch("property_postal_code");

  // County is a UI-only filter (not saved to the loan) used to narrow city choices.
  const [countyValue, setCountyValue] = useState<string | null>(null);

  // US_STATES is a static constant — no fetch needed, instantly available.
  const { data: usCounties = [], isLoading: loadingCounties } = useUSCountiesByState(stateValue);
  const { data: usCities = [], isLoading: loadingCities } = useUSCitiesByStateCounty(stateValue, countyValue);

  // When city is selected from the dropdown, auto-fill ZIP via city+state lookup.
  useEffect(() => {
    const city = cityValue?.trim() ?? "";
    const state = (stateValue?.trim() ?? "").toUpperCase();
    if (!city || city === autofilled.current.city || city.length < 2 || state.length !== 2) return;
    debounced(async () => {
      const result = await lookupByCityState(city, state);
      if (result) {
        autofilled.current.zip = result.zip;
        setValue("property_postal_code", result.zip, { shouldDirty: true });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityValue]);

  const { data: loan, isLoading: loadingLoan } = useLoan(id);
  const { data: borrowers, isLoading: loadingBorrowers } = useBorrowers();
  const { data: products } = useLoanProducts();
  const { data: programs } = useLoanPrograms(productId ?? undefined);
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [myBranchId, setMyBranchId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const myCustomRole = normalizeRoleString(profile?.customRoleName);
  const isBranchScopedRole = myCustomRole === "branch_manager" || myCustomRole === "loan_officer";

  const programsFiltered = programs ?? [];

  useEffect(() => {
    if (loan) {
      reset({
        loan_number: loan.loan_number,
        borrower_id: loan.borrower_id,
        branch_id: loan.branch_id ?? null,
        product_id: loan.product_id ?? null,
        program_id: loan.program_id ?? null,
        status: loan.status,
        loan_amount: loan.loan_amount != null ? Number(loan.loan_amount) : null,
        appraised_value: loan.appraised_value != null ? Number(loan.appraised_value) : null,
        ltv: loan.ltv != null ? Number(loan.ltv) : null,
        credit_score: loan.credit_score ?? null,
        dti: loan.dti != null ? Number(loan.dti) : null,
        purpose: loan.purpose ?? null,
        occupancy_type: loan.occupancy_type ?? null,
        property_address: loan.property_address ?? null,
        property_city: loan.property_city ?? null,
        property_state: loan.property_state ?? null,
        property_postal_code: loan.property_postal_code ?? null,
        lock_date: loan.lock_date ?? null,
        lock_expiration_date: loan.lock_expiration_date ?? null,
      });
    }
  }, [loan, reset]);

  useEffect(() => {
    const loadBranchContext = async () => {
      if (!user?.id) return;
      setLoadingBranches(true);
      try {
        const [{ data: profileRow, error: profileErr }, { data: branchesRows, error: branchesErr }] =
          await Promise.all([
            supabase.from("profiles").select("branch_id").eq("id", user.id).maybeSingle(),
            supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
          ]);
        if (profileErr) throw profileErr;
        if (branchesErr) throw branchesErr;
        const branchId = profileRow?.branch_id ?? null;
        setMyBranchId(branchId);
        setBranches((branchesRows ?? []) as Array<{ id: string; name: string }>);
      } catch (e) {
        console.error("Failed to load branches/profile branch:", e);
      } finally {
        setLoadingBranches(false);
      }
    };
    loadBranchContext();
  }, [user?.id]);

  useEffect(() => {
    if (!isBranchScopedRole) return;
    if (myBranchId) {
      setValue("branch_id", myBranchId);
    }
  }, [isBranchScopedRole, myBranchId, setValue]);

  const onSubmit = async (data: LoanFormData) => {
    if (!user?.id) return;
    try {
      if (isBranchScopedRole && !myBranchId) {
        throw new Error("Your profile is missing a branch assignment. Contact an admin.");
      }

      const finalBranchId =
        isBranchScopedRole ? myBranchId : (data.branch_id ?? null);

      if (isEdit && id) {
        if (isBranchScopedRole && loan?.branch_id && loan.branch_id !== myBranchId) {
          throw new Error("You can only edit loans in your assigned branch.");
        }
        await updateLoan.mutateAsync({
          id,
          data: {
            loan_number: data.loan_number,
            borrower_id: data.borrower_id,
            branch_id: finalBranchId,
            product_id: data.product_id ?? null,
            program_id: data.program_id ?? null,
            loan_amount: data.loan_amount ?? null,
            appraised_value: data.appraised_value ?? null,
            ltv: data.ltv ?? null,
            credit_score: data.credit_score ?? null,
            dti: data.dti ?? null,
            purpose: data.purpose ?? null,
            occupancy_type: data.occupancy_type ?? null,
            property_address: data.property_address ?? null,
            property_city: data.property_city ?? null,
            property_state: data.property_state ?? null,
            property_postal_code: data.property_postal_code ?? null,
            lock_date: data.lock_date || null,
            lock_expiration_date: data.lock_expiration_date || null,
          },
        });
      } else {
        await createLoan.mutateAsync({
          loan_number: data.loan_number,
          borrower_id: data.borrower_id,
          loan_officer_id: user.id,
          branch_id: finalBranchId,
          product_id: data.product_id ?? null,
          program_id: data.program_id ?? null,
          status: data.status,
          loan_amount: data.loan_amount ?? null,
          appraised_value: data.appraised_value ?? null,
          ltv: data.ltv ?? null,
          credit_score: data.credit_score ?? null,
          dti: data.dti ?? null,
          purpose: data.purpose ?? null,
          occupancy_type: data.occupancy_type ?? null,
          property_address: data.property_address ?? null,
          property_city: data.property_city ?? null,
          property_state: data.property_state ?? null,
          property_postal_code: data.property_postal_code ?? null,
          lock_date: data.lock_date || null,
          lock_expiration_date: data.lock_expiration_date || null,
        });
      }
      navigate(redirectToLoanDetail);
    } catch (e) {
      console.error(e);
    }
  };

  const isSubmitting = createLoan.isPending || updateLoan.isPending;

  if ((loadingLoan || loadingBorrowers) && isEdit) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(redirectToLoanDetail)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Edit Loan" : "Add Loan"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update loan details" : "Create a new loan (manual or API-sync ready)"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loan &amp; borrower</CardTitle>
            <CardDescription>Required fields</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loan_number">Loan number</Label>
              <Input id="loan_number" {...register("loan_number")} />
              {errors.loan_number && (
                <p className="text-sm text-destructive">{errors.loan_number.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Borrower</Label>
              <SearchableSelect
                value={watch("borrower_id") || "__none__"}
                onChange={(v) => setValue("borrower_id", v === "__none__" ? "" : v)}
                placeholder="Select borrower"
                options={[
                  { value: "__none__", label: "Select borrower" },
                  ...(borrowers ?? []).map((b) => ({
                    value: b.id,
                    label: `${b.first_name} ${b.last_name}${b.email ? ` (${b.email})` : ""}`,
                  })),
                ]}
              />
              {errors.borrower_id && (
                <p className="text-sm text-destructive">{errors.borrower_id.message}</p>
              )}
              <Button type="button" variant="link" className="px-0" asChild>
                <Link to="/borrowers/new">Add new borrower</Link>
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <SearchableSelect
                value={watch("branch_id") || "__none__"}
                onChange={(v) => setValue("branch_id", v === "__none__" ? null : v)}
                placeholder={loadingBranches ? "Loading branches..." : "Select branch"}
                disabled={loadingBranches || (isBranchScopedRole && !isAdmin)}
                options={[
                  { value: "__none__", label: "Unassigned" },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
              {isBranchScopedRole && (
                <p className="text-xs text-muted-foreground">
                  Branch Manager and Loan Officer are restricted to their assigned branch.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <SearchableSelect
                value={watch("product_id") || "__none__"}
                onChange={(v) => {
                  setValue("product_id", v === "__none__" ? null : v);
                  setValue("program_id", null);
                }}
                placeholder="Optional"
                options={[
                  { value: "__none__", label: "—" },
                  ...(products ?? []).map((p) => ({
                    value: p.id,
                    label: `${p.product_name} (${p.rate_type})`,
                  })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Program</Label>
              <SearchableSelect
                value={watch("program_id") || "__none__"}
                onChange={(v) => setValue("program_id", v === "__none__" ? null : v)}
                placeholder="Optional"
                options={[
                  { value: "__none__", label: "—" },
                  ...programsFiltered.map((p) => ({
                    value: p.id,
                    label: `${p.program_name} (${p.program_code})`,
                  })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              {isEdit ? (
                <>
                  <Input
                    value={PIPELINE_STAGE_SELECT_OPTIONS.find((o) => o.value === watch("status"))?.label ?? watch("status")}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Status can only be changed via the transition buttons on the loan detail page.
                  </p>
                </>
              ) : (
                <SearchableSelect
                  value={watch("status")}
                  onChange={(v) => setValue("status", v)}
                  options={PIPELINE_STAGE_SELECT_OPTIONS.filter((o) =>
                    ["draft", "application"].includes(o.value)
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amounts &amp; eligibility</CardTitle>
            <CardDescription>Loan amount, LTV, credit, DTI</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loan_amount">Loan amount</Label>
              <Input id="loan_amount" type="number" step="0.01" {...register("loan_amount")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appraised_value">Appraised value</Label>
              <Input id="appraised_value" type="number" step="0.01" {...register("appraised_value")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ltv">LTV %</Label>
              <Input id="ltv" type="number" step="0.01" {...register("ltv")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit_score">Credit score</Label>
              <Input id="credit_score" type="number" {...register("credit_score")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dti">DTI %</Label>
              <Input id="dti" type="number" step="0.01" {...register("dti")} />
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <SearchableSelect
                value={watch("purpose") || "__none__"}
                onChange={(v) => setValue("purpose", v === "__none__" ? null : v)}
                placeholder="Optional"
                options={[
                  { value: "__none__", label: "—" },
                  { value: "Purchase", label: "Purchase" },
                  { value: "Refinance", label: "Refinance" },
                  { value: "CashOutRefinance", label: "Cash-out refinance" },
                  { value: "Construction", label: "Construction" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Occupancy</Label>
              <SearchableSelect
                value={watch("occupancy_type") || "__none__"}
                onChange={(v) => setValue("occupancy_type", v === "__none__" ? null : v)}
                placeholder="Optional"
                options={[
                  { value: "__none__", label: "—" },
                  { value: "Primary", label: "Primary" },
                  { value: "SecondHome", label: "Second home" },
                  { value: "Investment", label: "Investment" },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Property &amp; lock dates
              {zipcodeLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Select state → county → city and ZIP will auto-populate.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="property_address">Property address</Label>
              <Input id="property_address" {...register("property_address")} />
            </div>
            {/* ── State ── */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>State <span className="text-destructive">*</span></Label>
              </div>
              <SearchableSelect
                value={watch("property_state") || "__none__"}
                onChange={(v) => {
                  const next = v === "__none__" ? null : v;
                  setValue("property_state", next, { shouldDirty: true });
                  // Cascade: clear county → city → ZIP
                  setCountyValue(null);
                  setValue("property_city", null, { shouldDirty: true });
                  setValue("property_postal_code", null, { shouldDirty: true });
                }}
                placeholder="Select state"
                clearable
                options={US_STATES}
              />
            </div>

            {/* ── County ── */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>County</Label>
                {stateValue?.trim() && !loadingCounties && (
                  <span className="text-xs text-muted-foreground">{usCounties.length} counties</span>
                )}
              </div>
              <SearchableSelect
                value={countyValue || "__none__"}
                onChange={(v) => {
                  const next = v === "__none__" ? null : v;
                  setCountyValue(next);
                  // Cascade: clear city → ZIP
                  setValue("property_city", null, { shouldDirty: true });
                  setValue("property_postal_code", null, { shouldDirty: true });
                }}
                placeholder={
                  !stateValue?.trim()
                    ? "Select state first"
                    : loadingCounties
                      ? "Loading counties…"
                      : "Select county"
                }
                disabled={!stateValue?.trim()}
                clearable
                options={
                  loadingCounties
                    ? [{ value: "__loading__", label: "Loading…" }]
                    : usCounties.map((c) => ({ value: c, label: c }))
                }
              />
            </div>

            {/* ── City ── */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>City <span className="text-destructive">*</span></Label>
                {stateValue?.trim() && !loadingCities && (
                  <span className="text-xs text-muted-foreground">{usCities.length} cities</span>
                )}
              </div>
              <SearchableSelect
                value={watch("property_city") || "__none__"}
                onChange={async (v) => {
                  if (v === "__loading__") return;
                  const city = v === "__none__" ? null : v;
                  setValue("property_city", city, { shouldDirty: true });
                  setValue("property_postal_code", null, { shouldDirty: true });

                  // Auto-fill county when city is selected without one
                  if (city && !countyValue && stateValue?.trim()) {
                    const county = await lookupCountyByCity(stateValue, city);
                    if (county) setCountyValue(county);
                  }
                }}
                placeholder={
                  !stateValue?.trim()
                    ? "Select state first"
                    : loadingCities
                      ? "Loading cities…"
                      : "Select city"
                }
                disabled={!stateValue?.trim()}
                clearable
                options={
                  loadingCities
                    ? [{ value: "__loading__", label: "Loading…" }]
                    : usCities.map((c) => ({ value: c, label: c }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property_postal_code">Postal code</Label>
              <div className="relative">
                <Input
                  id="property_postal_code"
                  maxLength={5}
                  placeholder="5-digit ZIP"
                  {...register("property_postal_code")}
                />
                {zipcodeLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lock_date">Lock date</Label>
              <Input id="lock_date" type="date" {...register("lock_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lock_expiration_date">Lock expiration</Label>
              <Input id="lock_expiration_date" type="date" {...register("lock_expiration_date")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update loan" : "Create loan"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(redirectToLoanDetail)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
