import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/industries/$group")({
  component: () => <Outlet />,
});
