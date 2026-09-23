import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

export type TrainingExample = { question: string; answer: string };

/**
 * Per-workspace training data for the assistant: a glossary, a tone note and
 * worked examples. Rows are RLS-scoped to the workspace, so one tenant's
 * wording never leaks into another tenant's answers.
 */
export function PackAiTraining({ tenantId, group, slug }: { tenantId: number; group: string; slug: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pack-ai-training", tenantId, group, slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_ai_training")
        .select("glossary, tone, examples")
        .eq("tenant_id", tenantId)
        .eq("group_slug", group)
        .eq("pack_slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as { glossary: string | null; tone: string | null; examples: unknown } | null;
    },
  });

  const [glossary, setGlossary] = useState("");
  const [tone, setTone] = useState("");
  const [examples, setExamples] = useState<TrainingExample[]>([]);

  useEffect(() => {
    if (isLoading) return;
    setGlossary(data?.glossary ?? "");
    setTone(data?.tone ?? "");
    setExamples(Array.isArray(data?.examples) ? (data!.examples as TrainingExample[]) : []);
  }, [data, isLoading]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const payload = {
        tenant_id: tenantId,
        group_slug: group,
        pack_slug: slug,
        glossary,
        tone,
        examples: examples.filter((e) => e.question.trim() && e.answer.trim()),
        created_by: auth.user?.id ?? null,
      };
      const { error } = await supabase
        .from("pack_ai_training")
        .upsert(payload as never, { onConflict: "tenant_id,group_slug,pack_slug" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("The assistant now uses this wording for your workspace");
      qc.invalidateQueries({ queryKey: ["pack-ai-training", tenantId, group, slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your own wording</CardTitle>
          <CardDescription>
            Teach the assistant the words your team actually uses. It applies to this workspace and this pack only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Glossary</Label>
            <Textarea
              rows={6}
              placeholder={"e.g.\n“File” means a loan application\n“Sanction” means the lender approved the amount"}
              value={glossary}
              onChange={(e) => setGlossary(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tone and style</Label>
            <Input
              placeholder="Short, factual, no fluff. Amounts in lakhs."
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Worked examples ({examples.length})</CardTitle>
          <CardDescription>Show a question and the answer you would have written yourself.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {examples.map((ex, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs">Question</Label>
                <Textarea
                  rows={3}
                  value={ex.question}
                  onChange={(e) => setExamples((xs) => xs.map((x, idx) => (idx === i ? { ...x, question: e.target.value } : x)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ideal answer</Label>
                <Textarea
                  rows={3}
                  value={ex.answer}
                  onChange={(e) => setExamples((xs) => xs.map((x, idx) => (idx === i ? { ...x, answer: e.target.value } : x)))}
                />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="icon" onClick={() => setExamples((xs) => xs.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setExamples((xs) => [...xs, { question: "", answer: "" }])}>
            <Plus className="mr-2 h-4 w-4" />Add example
          </Button>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save training
      </Button>
    </div>
  );
}
