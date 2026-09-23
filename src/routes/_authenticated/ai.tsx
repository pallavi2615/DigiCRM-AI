import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Send, Loader2, User, FileText, Save } from "lucide-react";
import { aiChat } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { INDUSTRIES } from "@/lib/industries";
import { INDUSTRY_PACKS } from "@/lib/industry-packs";
import { useIndustryAccess } from "@/lib/industry-access";
import { useActiveTenant } from "@/lib/queries/tenants";
import { useTenantPackKey } from "@/lib/pack-config";

import { convertProposalToDeal, proposalStageToDealStage } from "@/lib/proposal-deal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "AI Assistant — DigiCRM AI" },
      { name: "description", content: "Chat with the AI sales assistant and generate full proposal drafts from your leads, companies and industry." },
    ],
  }),
  component: AIPage,
});

interface Msg { role: "user" | "assistant"; content: string; }

const suggestions = [
  "Draft a cold outreach email for a SaaS prospect",
  "Analyze my pipeline and suggest which leads to prioritize",
  "Write a follow-up email after a demo call",
  "Give me 5 questions to qualify an enterprise lead",
];

function AIPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          AI Assistant
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Powered by Gemini · Chat about your sales workflow or generate a full proposal draft.</p>
      </div>

      <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
        <TabsList className="self-start">
          <TabsTrigger value="chat"><Sparkles className="mr-2 h-4 w-4" /> Chat</TabsTrigger>
          <TabsTrigger value="proposal"><FileText className="mr-2 h-4 w-4" /> Proposal</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex-1 min-h-0 mt-3">
          <ChatPanel />
        </TabsContent>
        <TabsContent value="proposal" className="flex-1 min-h-0 mt-3 overflow-y-auto">
          <ProposalPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// function ChatPanel() {
//   const chat = useServerFn(aiChat);
//   const [messages, setMessages] = useState<Msg[]>([]);
//   const [input, setInput] = useState("");
//   const [packKey, setPackKey] = useState("");
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const { unrestricted, groups } = useIndustryAccess();
//   const { active: activeTenant } = useActiveTenant();
//   const tenantPackKey = useTenantPackKey(activeTenant?.id ?? null);

//   const availablePacks = INDUSTRY_PACKS.filter((p) => unrestricted || groups.includes(p.group));
//   // A workspace with its own pack starts grounded in that pack, not in generic sales.
//   const effectiveKey = packKey || tenantPackKey || "none";
//   const activePack = availablePacks.find((p) => `${p.group}::${p.slug}` === effectiveKey);


//   useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

//   const send = useMutation({
//     mutationFn: async (text: string) => {
//       const next: Msg[] = [...messages, { role: "user", content: text }];
//       setMessages(next);
//       setInput("");
//       const res = await chat({
//         data: {
//           messages: next,
//           tenantId: activeTenant?.id ?? null,
//           ...(activePack ? { pack: { group: activePack.group, slug: activePack.slug } } : {}),
//         },
//       });
//       setMessages([...next, { role: "assistant", content: res.content }]);
//     },
//     onError: (e: Error) => toast.error(e.message),
//   });

//   const handleSend = () => { if (input.trim() && !send.isPending) send.mutate(input.trim()); };

//   const packSuggestions = activePack
//     ? [
//         `Which ${activePack.recordLabelPlural} in ${activePack.stages[1] ?? activePack.stages[0]} should I chase first?`,
//         `Draft a follow-up message for a ${activePack.partyLabel} stuck before ${activePack.wonStages[0]}.`,
//         `How do I improve our ${activePack.kpiLabels[0]}?`,
//         `What should I check before moving a ${activePack.recordLabel} to ${activePack.wonStages[0]}?`,
//       ]
//     : suggestions;

//   return (
//     <Card className="h-full flex flex-col shadow-card overflow-hidden">
//       <div className="border-b p-3 flex flex-wrap items-center gap-2">
//         <span className="text-xs text-muted-foreground">Answer in the language of:</span>
//         <Select value={effectiveKey} onValueChange={setPackKey}>
//           <SelectTrigger className="w-64 h-8 text-xs"><SelectValue placeholder="General sales" /></SelectTrigger>
//           <SelectContent className="max-h-72">
//             <SelectItem value="none">General sales</SelectItem>
//             {availablePacks.map((p) => (
//               <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>{p.groupName} · {p.name}</SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       </div>
//       <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
//         {messages.length === 0 && (
//           <div className="text-center py-8">
//             <div className="h-16 w-16 rounded-2xl gradient-primary mx-auto flex items-center justify-center mb-4"><Sparkles className="h-8 w-8 text-primary-foreground" /></div>
//             <h3 className="font-semibold text-lg">How can I help?</h3>
//             <p className="text-sm text-muted-foreground mb-6">Try one of these prompts:</p>
//             <div className="grid gap-2 max-w-md mx-auto">
//               {packSuggestions.map((s, i) => (
//                 <button key={i} onClick={() => send.mutate(s)} className="text-left text-sm p-3 rounded-lg border hover:bg-muted/50 transition-colors">{s}</button>
//               ))}
//             </div>
//           </div>
//         )}

//         {messages.map((m, i) => (
//           <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
//             <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${m.role === "user" ? "bg-primary text-primary-foreground" : "gradient-primary text-primary-foreground"}`}>
//               {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
//             </div>
//             <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] whitespace-pre-wrap text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
//               {m.content}
//             </div>
//           </div>
//         ))}
//         {send.isPending && (
//           <div className="flex gap-3">
//             <div className="h-8 w-8 shrink-0 rounded-full gradient-primary flex items-center justify-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
//             <div className="rounded-2xl px-4 py-3 bg-muted"><Loader2 className="h-4 w-4 animate-spin" /></div>
//           </div>
//         )}
//         <div ref={bottomRef} />
//       </CardContent>
//       <div className="border-t p-4 flex gap-2">
//         <Textarea
//           value={input}
//           onChange={(e) => setInput(e.target.value)}
//           onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
//           placeholder="Ask about a lead, request an email draft, or analyze your pipeline..."
//           rows={2}
//           className="resize-none"
//         />
//         <Button onClick={handleSend} disabled={send.isPending || !input.trim()} className="self-end">
//           <Send className="h-4 w-4" />
//         </Button>
//       </div>
//     </Card>
//   );
// }

function ChatPanel() {
  const chat = useServerFn(aiChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [packKey, setPackKey] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { unrestricted, groups } = useIndustryAccess();
  const { active: activeTenant } = useActiveTenant();
  const tenantPackKey = useTenantPackKey(activeTenant?.id ?? null);

  const availablePacks = INDUSTRY_PACKS.filter((p) => unrestricted || groups.includes(p.group));
  const effectiveKey = packKey || tenantPackKey || "none";
  const activePack = availablePacks.find((p) => `${p.group}::${p.slug}` === effectiveKey);

  // ✅ send ko PEHLE define karo, useEffect ke upar
  const send = useMutation({
    mutationFn: async ({ history }: { history: Msg[] }) => {
      return await chat({
        data: {
          messages: history,
          tenantId: activeTenant?.id ?? null,
          ...(activePack ? { pack: { group: activePack.group, slug: activePack.slug } } : {}),
        },
      });
    },
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.content }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ✅ Ab useEffect send ko safely use kar sakta hai
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, send.isPending]);

  const submitMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    send.mutate({ history });
  };

  const handleSend = () => submitMessage(input);

  // ✅ Dynamic suggestions — pack change hone pe ye automatically badal jaate hain
  const packSuggestions = activePack
    ? [
        `Which ${activePack.recordLabelPlural} in ${activePack.stages[1] ?? activePack.stages[0]} should I chase first?`,
        `Draft a follow-up message for a ${activePack.partyLabel} stuck before ${activePack.wonStages[0]}.`,
        `How do I improve our ${activePack.kpiLabels[0]}?`,
        `What should I check before moving a ${activePack.recordLabel} to ${activePack.wonStages[0]}?`,
      ]
    : suggestions;

  // ✅ Pack change hone pe chat clear karo — fresh suggestions dikhein
  const handlePackChange = (newKey: string) => {
    setPackKey(newKey);
    setMessages([]);   // ← YE LINE ADD KARO — chat clear ho jaayegi
  };

  return (
    <Card className="h-full flex flex-col shadow-card overflow-hidden">
      <div className="border-b p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Answer in the language of:</span>
        <Select value={effectiveKey} onValueChange={handlePackChange}>
          <SelectTrigger className="w-64 h-8 text-xs">
            <SelectValue placeholder="General sales" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="none">General sales</SelectItem>
            {availablePacks.map((p) => (
              <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>
                {p.groupName} · {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* ✅ Khali chat me bade suggestion cards — pack change pe turant badlenge */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-2xl gradient-primary mx-auto flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="font-semibold text-lg">How can I help?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {activePack ? `Suggestions for ${activePack.name}` : "Try one of these prompts:"}
            </p>
            <div className="grid gap-2 max-w-md mx-auto">
              {packSuggestions.map((s, i) => (
                <button
                  key={`${effectiveKey}-${i}`}
                  onClick={() => submitMessage(s)}
                  className="text-left text-sm p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat history */}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${m.role === "user" ? "bg-primary text-primary-foreground" : "gradient-primary text-primary-foreground"}`}>
              {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] whitespace-pre-wrap text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.content}
            </div>
          </div>
        ))}

        {send.isPending && (
          <div className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full gradient-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </CardContent>

      {/* ✅ Suggestions chips — input ke upar, pack change pe update hote hain */}
      {messages.length > 0 && !send.isPending && (
        <div className="border-t px-4 py-2 flex gap-2 overflow-x-auto scrollbar-thin">
          {packSuggestions.map((s, i) => (
            <button
              key={`${effectiveKey}-chip-${i}`}
              onClick={() => submitMessage(s)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full border bg-muted/40 hover:bg-muted transition-colors whitespace-nowrap"
              title={s}
            >
              {s.length > 45 ? s.slice(0, 45) + "…" : s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t p-4 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about a lead, request an email draft, or analyze your pipeline..."
          rows={2}
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={send.isPending || !input.trim()} className="self-end">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function ProposalPanel() {
  const chat = useServerFn(aiChat);
  const { user, isManager } = useAuth();
  const perms = usePermissions();
  const qc = useQueryClient();

  const [leadId, setLeadId] = useState("none");
  const [companyId, setCompanyId] = useState("none");
  const [industry, setIndustry] = useState(INDUSTRIES[0]?.name ?? "Technology");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [draft, setDraft] = useState("");
  const [addToPipeline, setAddToPipeline] = useState(true);

  const { data: related } = useQuery({
    queryKey: ["ai-proposal-related"],
    queryFn: async () => {
      const [leads, companies] = await Promise.all([
        supabase.from("leads").select("id, company_name, contact_person, industry, estimated_value, status")
          .is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
        supabase.from("companies").select("id, name, industry").is("deleted_at", null).order("name").limit(200),
      ]);
      return { leads: leads.data ?? [], companies: companies.data ?? [] };
    },
  });

  const lead = (related?.leads ?? []).find((l) => l.id === leadId);
  const company = (related?.companies ?? []).find((c) => c.id === companyId);

  const generate = useMutation({
    mutationFn: async () => {
      const client = company?.name || lead?.company_name;
      if (!client && !title.trim()) throw new Error("Pick a lead or company, or add a title first");
      const prompt = `Draft a complete, client-ready business proposal.

Client: ${client || title}
Industry: ${industry}
Primary contact: ${lead?.contact_person || "Not provided"}
Current pipeline stage: ${lead?.status || "new"}
Indicative deal value: ${value || lead?.estimated_value || "TBD"}

Include: executive summary, understanding of the client's needs in the ${industry} industry, scope of work, deliverables, implementation timeline, pricing table, success metrics and terms. Use clear markdown headings.`;
      const res = await chat({
        data: {
          messages: [{ role: "user", content: prompt }],
          context: leadId !== "none" ? [{ type: "leads" as const, id: leadId }] : undefined,
        },
      });
      setDraft(res.content);
      if (!title.trim() && client) setTitle(`${industry} proposal for ${client}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.trim()) throw new Error("Generate the draft first");
      if (!user?.id) throw new Error("Not signed in");
      const finalTitle = title.trim() || `${industry} proposal`;
      const dealValue = Number(value || lead?.estimated_value || 0);
      const { data: proposal, error } = await supabase.from("proposals").insert({
        title: finalTitle,
        description: `AI-generated ${industry} proposal`,
        lead_id: leadId === "none" ? null : leadId,
        company_id: companyId === "none" ? null : companyId,
        stage: "draft",
        value: dealValue,
        probability: 50,
        owner_id: user.id,
        created_by: user.id,
        ai_content: draft,
      }).select("id, title, lead_id, contact_id, company_id, stage, value, close_date, owner_id, notes").single();
      if (error) throw error;

      if (!addToPipeline) return { converted: false, pending: false };

      // Proposals need approval before they can become deals. Managers and
      // admins can approve their own draft inline; everyone else requests it.
      const { error: approvalError } = await supabase
        .from("proposals")
        .update({ approval_status: isManager ? "approved" : "pending" })
        .eq("id", proposal.id);
      if (approvalError) throw approvalError;

      if (!isManager) return { converted: false, pending: true };

      await convertProposalToDeal(
        { ...proposal, stage: "draft" as const, value: dealValue, approval_status: "approved" as const },
        { dealStage: proposalStageToDealStage.draft, value: dealValue, ownerId: user.id, userId: user.id },
      );
      return { converted: true, pending: false };
    },
    onSuccess: (res) => {
      toast.success(
        res?.converted ? "Proposal saved and added to the pipeline"
          : res?.pending ? "Proposal saved — sent for manager approval before it can become a deal"
            : "Proposal saved",
      );
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-proposals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      setDraft("");
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  if (!perms.canCreate("proposals")) {
    return (
      <Card className="shadow-card"><CardContent className="p-8 text-center text-sm text-muted-foreground">
        You don't have permission to create proposals. Ask an admin for access.
      </CardContent></Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(related?.leads ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(related?.companies ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i.slug} value={i.name}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Proposal title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Auto-filled after generating" />
          </div>
          <div className="space-y-1.5"><Label>Deal value (₹)</Label>
            <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder={String(lead?.estimated_value ?? "")} />
          </div>
        </div>

        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate proposal draft
        </Button>

        <Textarea
          rows={14}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your AI-generated proposal appears here — edit it before saving."
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={addToPipeline} onCheckedChange={(c) => setAddToPipeline(c === true)} />
            Also create a Pipeline deal with this lead, company and owner
          </label>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !draft.trim()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save as proposal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
