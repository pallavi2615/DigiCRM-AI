import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stages = [
  {
    id: "new",
    title: "New Enquiry",
    count: 12,
  },
  {
    id: "contacted",
    title: "Contacted",
    count: 8,
  },
  {
    id: "appointment",
    title: "Appointment Scheduled",
    count: 6,
  },
  {
    id: "consultation",
    title: "Consultation",
    count: 5,
  },
  {
    id: "treatment",
    title: "Treatment",
    count: 4,
  },
  {
    id: "followup",
    title: "Follow-up",
    count: 3,
  },
  {
    id: "converted",
    title: "Converted",
    count: 8,
  },
];

export function HealthcarePipeline() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          Healthcare Pipeline
        </h2>

        <p className="text-sm text-muted-foreground">
          Track patient enquiries from initial contact to conversion.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {stages.map((stage) => (
          <Card key={stage.id} className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {stage.title}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-2xl font-bold">
                {stage.count}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Patients
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}