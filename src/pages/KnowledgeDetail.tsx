import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import {
  useKnowledgeEntry,
  useDeleteKnowledgeEntry,
  useIncrementViewCount,
} from "@/hooks/useKnowledge";
import { RelatedArticles } from "@/components/knowledge/RelatedArticles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  ArrowLeft,
  FileText,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Tag,
  Download,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";

export default function KnowledgeDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [reparsing, setReparsing] = useState(false);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);

  const { data: entry, isLoading, error } = useKnowledgeEntry(id || "");
  const deleteEntry = useDeleteKnowledgeEntry();
  const incrementViewCount = useIncrementViewCount();

  useEffect(() => {
    if (id) {
      incrementViewCount.mutate(id);
    }
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteEntry.mutateAsync(id);
      navigate("/knowledge");
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const canEdit = Boolean(user && entry && entry.author_id === user.id);
  const fileUrl = entry?.metadata?.file_url;
  const fileName = entry?.metadata?.file_name;
  const filePath = entry?.metadata?.file_path;
  const storageBucket =
    typeof entry?.metadata?.storage_bucket === "string" && entry.metadata.storage_bucket
      ? entry.metadata.storage_bucket
      : "user-knowledge";
  const isPdf = entry?.metadata?.is_pdf || fileName?.toLowerCase().endsWith('.pdf');
  const hasExtractedContent = entry?.metadata?.has_extracted_content;
  const parseStatus = entry?.metadata?.parse_status as string | undefined;
  const placeholderUpload =
    typeof entry?.content === "string" && entry.content.includes("This file has been uploaded");
  const showReparse =
    Boolean(canEdit && filePath &&
      (parseStatus === "error" ||
        hasExtractedContent !== true ||
        placeholderUpload));

  const handleReparse = async () => {
    if (!id || !canEdit) return;
    setReparsing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("parse-document", {
        body: { knowledge_entry_id: id, storage_bucket: storageBucket },
      });
      if (fnError) throw fnError;
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        toast.error((data as { error: string }).error);
        return;
      }
      toast.success("Document text extracted successfully.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.entry(id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.entries() });
    } catch (err) {
      toast.error((err as Error)?.message ?? "Could not extract text from the file.");
    } finally {
      setReparsing(false);
    }
  };

  // For private buckets, generate signed URL
  React.useEffect(() => {
    const getSignedUrl = async () => {
      if (filePath && !hasExtractedContent) {
        try {
          const { data, error: urlError } = await supabase.storage
            .from(storageBucket)
            .createSignedUrl(filePath, 3600);
          if (!urlError && data?.signedUrl) {
            setSignedUrl(data.signedUrl);
          }
        } catch {
          // Bucket or file not found — skip PDF viewer
        }
      }
    };
    getSignedUrl();
  }, [filePath, hasExtractedContent, storageBucket]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg font-semibold">Article Not Found</p>
        <p className="text-muted-foreground text-center max-w-md">
          The article you're looking for doesn't exist or has been removed.
        </p>
        <Button variant="outline" onClick={() => navigate("/knowledge")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Knowledge Base
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/knowledge")}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-4xl font-bold tracking-tight">{entry.title}</h1>
          
          {/* Metadata */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(entry.created_at)}
            </div>
            {entry.view_count !== null && entry.view_count > 0 && (
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {entry.view_count} views
              </div>
            )}
            {entry.knowledge_categories && (
              <Badge variant="outline">
                {entry.knowledge_categories.name}
              </Badge>
            )}
            {entry.status && (
              <Badge variant="secondary">{entry.status}</Badge>
            )}
            {fileName && (
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {fileName}
              </div>
            )}
          </div>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/knowledge/${id}/edit`)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Article</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this article? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {canEdit && showReparse && (
            <Button
              variant="secondary"
              size="sm"
              disabled={reparsing}
              onClick={() => void handleReparse()}
            >
              {reparsing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Extract text again
            </Button>
          )}
          {fileUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(fileUrl, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Download File
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      {entry.summary && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{entry.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <Card>
        <CardContent className="prose prose-slate dark:prose-invert max-w-none pt-6">
          <ReactMarkdown>{entry.content}</ReactMarkdown>
        </CardContent>
      </Card>

      {/* PDF Viewer for uploaded PDF files — only when a valid signed URL is available */}
      {isPdf && signedUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              PDF Document Viewer
            </CardTitle>
            <CardDescription>
              View the uploaded PDF document below or download it using the button above
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
              <iframe
                src={signedUrl}
                className="w-full h-[800px]"
                title={fileName || "PDF Document"}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(signedUrl, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = signedUrl ?? '';
                  link.download = fileName || 'document.pdf';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Articles */}
      {id && <RelatedArticles entryId={id} />}
    </div>
  );
}
