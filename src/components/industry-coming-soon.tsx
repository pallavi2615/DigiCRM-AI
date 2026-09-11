import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function IndustryComingSoon({ icon: Icon, title, blurb }: { icon: LucideIcon; title: string; blurb: string }) {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full text-center">
        <CardContent className="pt-8 pb-8 space-y-4">
          <div className="h-16 w-16 mx-auto rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground shadow-elegant">
            <Icon className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{blurb}</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> Coming next phase
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
