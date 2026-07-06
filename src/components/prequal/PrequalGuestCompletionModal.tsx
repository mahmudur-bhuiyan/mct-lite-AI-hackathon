import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { splitBorrowerName } from "../../../supabase/functions/_shared/prequal-tools";
import type { AssignedOfficerProfile, GuestBorrowerProfile } from "@/hooks/usePrequalAgent";
import { US_STATES } from "@/hooks/useUSLocationOptions";
import {
  constrainPhoneInput,
  normalizePhoneForStorage,
  phoneToInputDisplay,
  PHONE_FORMAT_EXAMPLE,
} from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";

export interface PrequalGuestCompletionValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  street_address: string;
  postal_code: string;
}

export type PrequalGuestCompletionMode = "complete" | "update";

interface PrequalGuestCompletionModalProps {
  open: boolean;
  mode?: PrequalGuestCompletionMode;
  assignedOfficer: string;
  assignedOfficerProfile?: AssignedOfficerProfile | null;
  borrowerName?: string | null;
  borrowerEmail?: string | null;
  borrowerPhone?: string | null;
  borrowerCity?: string | null;
  borrowerState?: string | null;
  borrowerStreetAddress?: string | null;
  borrowerPostalCode?: string | null;
  existingBorrowerProfile?: GuestBorrowerProfile | null;
  /** Intake first/last from guest form (fallback when chat name not split yet). */
  intakeFirstName?: string;
  intakeLastName?: string;
  submitting: boolean;
  onSubmit: (values: PrequalGuestCompletionValues) => Promise<void>;
  onDismiss: () => void;
}

function buildInitialValues(
  borrowerName: string | null | undefined,
  borrowerEmail: string | null | undefined,
  borrowerPhone: string | null | undefined,
  intakeFirstName?: string,
  intakeLastName?: string,
  borrowerCity?: string | null,
  borrowerState?: string | null,
  borrowerStreetAddress?: string | null,
  borrowerPostalCode?: string | null,
  existingBorrowerProfile?: GuestBorrowerProfile | null,
): PrequalGuestCompletionValues {
  const fromExisting =
    existingBorrowerProfile?.first_name || existingBorrowerProfile?.last_name
      ? {
          first_name: existingBorrowerProfile.first_name?.trim() ?? "",
          last_name: existingBorrowerProfile.last_name?.trim() ?? "",
        }
      : null;
  const fromChat = splitBorrowerName(borrowerName ?? "");
  const first =
    fromExisting?.first_name ||
    fromChat.first_name ||
    intakeFirstName?.trim() ||
    "";
  const last =
    fromExisting?.last_name ||
    fromChat.last_name ||
    intakeLastName?.trim() ||
    "";

  return {
    first_name: first,
    last_name: last,
    email:
      existingBorrowerProfile?.email?.trim() ||
      borrowerEmail?.trim() ||
      "",
    phone: phoneToInputDisplay(
      existingBorrowerProfile?.phone ?? borrowerPhone,
    ),
    city: existingBorrowerProfile?.city?.trim() || borrowerCity?.trim() || "",
    state:
      existingBorrowerProfile?.state?.trim().toUpperCase() ||
      borrowerState?.trim().toUpperCase() ||
      "",
    street_address:
      existingBorrowerProfile?.street_address?.trim() ||
      borrowerStreetAddress?.trim() ||
      "",
    postal_code:
      existingBorrowerProfile?.postal_code?.trim() ||
      borrowerPostalCode?.trim() ||
      "",
  };
}

export function PrequalGuestCompletionModal({
  open,
  mode = "complete",
  assignedOfficer,
  assignedOfficerProfile,
  borrowerName,
  borrowerEmail,
  borrowerPhone,
  borrowerCity,
  borrowerState,
  borrowerStreetAddress,
  borrowerPostalCode,
  existingBorrowerProfile,
  intakeFirstName,
  intakeLastName,
  submitting,
  onSubmit,
  onDismiss,
}: PrequalGuestCompletionModalProps) {
  const isUpdate = mode === "update";
  const officer = assignedOfficerProfile;
  const [values, setValues] = useState<PrequalGuestCompletionValues>(() =>
    buildInitialValues(
      borrowerName,
      borrowerEmail,
      borrowerPhone,
      intakeFirstName,
      intakeLastName,
      borrowerCity,
      borrowerState,
      borrowerStreetAddress,
      borrowerPostalCode,
      existingBorrowerProfile,
    ),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValues(
      buildInitialValues(
        borrowerName,
        borrowerEmail,
        borrowerPhone,
        intakeFirstName,
        intakeLastName,
        borrowerCity,
        borrowerState,
        borrowerStreetAddress,
        borrowerPostalCode,
        existingBorrowerProfile,
      ),
    );
    setError("");
  }, [
    open,
    borrowerName,
    borrowerEmail,
    borrowerPhone,
    borrowerCity,
    borrowerState,
    borrowerStreetAddress,
    borrowerPostalCode,
    intakeFirstName,
    intakeLastName,
    existingBorrowerProfile,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const first = values.first_name.trim();
    const last = values.last_name.trim();
    const city = values.city.trim();
    const state = values.state.trim().toUpperCase();
    const email = values.email.trim();
    const phone = values.phone.trim();

    if (!first || !last) {
      setError("First and last name are required.");
      return;
    }
    if (!city) {
      setError("City is required.");
      return;
    }
    if (state.length !== 2) {
      setError("Please select a valid state.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    const normalizedPhone = phone ? normalizePhoneForStorage(phone) : "";
    if (phone && !normalizedPhone) {
      setError(`Enter an 11-digit US number (e.g. ${PHONE_FORMAT_EXAMPLE}).`);
      return;
    }

    try {
      await onSubmit({
        ...values,
        first_name: first,
        last_name: last,
        city,
        state,
        email,
        phone: normalizedPhone,
        street_address: values.street_address.trim(),
        postal_code: values.postal_code.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isUpdate
            ? "Could not update your profile."
            : "Could not save your profile.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onDismiss()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => submitting && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? "Update your profile" : "Complete your profile"}
          </DialogTitle>
          <DialogDescription>
            {isUpdate ? (
              <>
                You&apos;re pre-qualified again. Review your contact details below — submit only
                if something changed so {assignedOfficer}
                {officer?.title ? ` (${officer.title})` : ""} has your latest info.
              </>
            ) : (
              <>
                You&apos;re pre-qualified. {assignedOfficer}
                {officer?.title ? ` (${officer.title})` : ""} will get back to you — confirm your
                details below so we can connect you.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive rounded-md border border-destructive/20 bg-destructive/5 p-2">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="completion-first-name">
                First name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="completion-first-name"
                value={values.first_name}
                onChange={(e) => setValues((v) => ({ ...v, first_name: e.target.value }))}
                required
                disabled={submitting}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completion-last-name">
                Last name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="completion-last-name"
                value={values.last_name}
                onChange={(e) => setValues((v) => ({ ...v, last_name: e.target.value }))}
                required
                disabled={submitting}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="completion-email">Email</Label>
              <Input
                id="completion-email"
                type="email"
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                disabled={submitting}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completion-phone">Phone</Label>
              <Input
                id="completion-phone"
                type="tel"
                value={values.phone}
                onChange={(e) =>
                  setValues((v) => ({ ...v, phone: constrainPhoneInput(e.target.value) }))
                }
                placeholder={PHONE_FORMAT_EXAMPLE}
                disabled={submitting}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="completion-street">Street address</Label>
            <Input
              id="completion-street"
              value={values.street_address}
              onChange={(e) => setValues((v) => ({ ...v, street_address: e.target.value }))}
              disabled={submitting}
              autoComplete="street-address"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                value={values.city}
                onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
                required
                disabled={submitting}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-2">
              <Label>
                State <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                value={values.state || "__none__"}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, state: v === "__none__" ? "" : v }))
                }
                placeholder="Select state"
                clearable
                options={US_STATES}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="completion-zip">Postal code</Label>
            <Input
              id="completion-zip"
              maxLength={5}
              value={values.postal_code}
              onChange={(e) => setValues((v) => ({ ...v, postal_code: e.target.value }))}
              disabled={submitting}
              autoComplete="postal-code"
            />
          </div>

          <DialogFooter className="sm:justify-stretch">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdate ? "Save profile changes" : "Connect with your loan officer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
