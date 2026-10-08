import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { WorkspaceTemplate } from "@/lib/workspace-templates";

export function TemplatePreview({ t }: { t: WorkspaceTemplate }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{t.name}</h2>
        <p className="text-sm text-muted-foreground">{t.positioning}</p>
        <div className="flex gap-1 mt-2">
          <Badge variant="secondary">{t.group}</Badge>
          <Badge variant="outline">Wave {t.wave}</Badge>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase">Record</p>
          <p className="text-sm">{t.recordLabel} / {t.recordLabelPlural}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase">Customer</p>
          <p className="text-sm">{t.partyLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase">Value</p>
          <p className="text-sm">{t.valueLabel}</p>
        </div>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Stages ({t.stages.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {t.stages.map((s) => (
            <Badge
              key={s}
              variant={
                t.wonStages.includes(s)
                  ? "default"
                  : t.lostStages.includes(s)
                    ? "destructive"
                    : "secondary"
              }
            >
              {s}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {t.fields.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fields ({t.fields.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {t.fields.map((f) => (
              <div key={f.key} className="flex justify-between text-xs">
                <span>{f.label}</span>
                <span className="text-muted-foreground">{f.type}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {t.agents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Agents ({t.agents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {t.agents.map((a) => (
              <div key={a.key} className="text-xs">
                <p className="font-medium">{a.label}</p>
                <p className="text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}