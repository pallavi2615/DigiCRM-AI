import {
  CalendarDays,
  Users,
  UserPlus,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function HealthcareDashboard() {
  const stats = [
    {
      label: "Total Patients",
      value: "1,248",
      sub: "+12% this month",
      icon: Users,
    },
    {
      label: "New Patients",
      value: "86",
      sub: "This month",
      icon: UserPlus,
    },
    {
      label: "Appointments",
      value: "42",
      sub: "Today",
      icon: CalendarDays,
    },
    {
      label: "Follow-ups",
      value: "18",
      sub: "Due today",
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>

                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>

              <p className="text-2xl font-bold mt-1">
                {stat.value}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                {stat.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Today's Appointments
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-sm text-muted-foreground">
              Appointment data will appear here.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Patient Overview
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-sm text-muted-foreground">
              Patient analytics will appear here.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Follow-ups + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Follow-ups Due
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-sm text-muted-foreground">
              Follow-up records will appear here.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-sm text-muted-foreground">
              Recent healthcare activities will appear here.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}