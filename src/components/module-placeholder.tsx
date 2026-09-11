import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function ModulePlaceholder({
  title, description, icon: Icon, features,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{className?: string}>;
  features: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Sparkles className="h-3 w-3" /> Coming soon
        </Badge>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground shadow-elegant mx-auto mb-4">
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Nothing here yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            {description} Everything you create lands here — grouped, filterable and ready to hand off to teammates.
          </p>
          <div className="max-w-lg mx-auto text-left space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">What this module gives you</p>
            <ul className="space-y-1.5">
              {features.map(f => (
                <li key={f} className="flex gap-2 text-sm">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Tip: press <kbd className="px-1.5 py-0.5 rounded border font-mono text-[10px]">⌘K</kbd> anywhere to jump between modules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
