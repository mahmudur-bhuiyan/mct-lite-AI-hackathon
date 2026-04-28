import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload, FileCheck } from "lucide-react";
import { downloadTextFile } from "@/lib/export-utils";
import { logActivity } from "@/lib/activity-logger";

const CSV_TEMPLATE = `loan_number,external_id,data_source,borrower_id,loan_officer_id,status,loan_amount,property_address,property_city,property_state,property_postal_code
LN-EXAMPLE-001,ext-001,csv_import,PASTE-BORROWER-UUID,PASTE-OFFICER-UUID,draft,350000,123 Main St,Austin,TX,78701`;

export default function LoanImport() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState<null | "dry" | "apply">(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  function downloadTemplate() {
    downloadTextFile(CSV_TEMPLATE, "mct-loan-import-template.csv", "text/csv;charset=utf-8;");
    toast.success("Template downloaded");
  }

  async function runImport(dryRun: boolean) {
    if (!csvText.trim()) {
      toast.error("Paste CSV content first.");
      return;
    }
    setLoading(dryRun ? "dry" : "apply");
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-loans-csv", {
        body: { csv_text: csvText, dry_run: dryRun },
      });
      if (error) throw error;
      const body = data as {
        error?: string;
        errors?: { line: number; message: string }[];
        valid_rows?: number;
        message?: string;
        imported?: number;
        updated?: number;
        failed?: number;
      };
      if (body?.error) throw new Error(body.error);

      if (body.errors && body.errors.length > 0) {
        const msg = body.errors.map((e) => `Line ${e.line}: ${e.message}`).join("\n");
        setLastResult(msg);
        toast.error("Validation issues — see details below.");
        return;
      }

      if (dryRun) {
        setLastResult(body.message ?? `OK — ${body.valid_rows ?? 0} row(s) valid.`);
        logActivity({
          action: "view",
          resourceType: "loan",
          details: { operation: "import_dry_run", valid_rows: body.valid_rows ?? 0 },
        });
        toast.success("Dry run passed. You can apply the import.");
      } else {
        setLastResult(
          `Imported ${body.imported ?? 0}, updated ${body.updated ?? 0}, failed ${body.failed ?? 0}.`,
        );
        logActivity({
          action: "create",
          resourceType: "loan",
          details: {
            operation: "import_apply",
            imported: body.imported ?? 0,
            updated: body.updated ?? 0,
            failed: body.failed ?? 0,
          },
        });
        toast.success("Import finished.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/loans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import loans (CSV)</h1>
        <p className="text-sm text-muted-foreground">
          Upsert by <code className="text-xs">data_source</code> + <code className="text-xs">external_id</code>.
          Requires admin or <code className="text-xs">loans:import</code>. Run a dry run before applying.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          Borrower and loan officer IDs must already exist. Prefer LOS sync for ongoing data; use this for
          controlled bulk loads and migrations.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>CSV</CardTitle>
          <CardDescription>
            Header row required. Columns: loan_number, external_id, data_source, borrower_id, loan_officer_id,
            status, optional loan_amount and property fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              Download template
            </Button>
          </div>
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste CSV here..."
            className="min-h-[220px] font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={loading !== null}
              onClick={() => runImport(true)}
            >
              {loading === "dry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
              Dry run
            </Button>
            <Button type="button" disabled={loading !== null} onClick={() => runImport(false)}>
              {loading === "apply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Apply import
            </Button>
          </div>
          {lastResult && (
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
              {lastResult}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
