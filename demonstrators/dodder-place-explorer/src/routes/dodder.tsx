import { createFileRoute } from "@tanstack/react-router";
import { Experience } from "@/components/experience";

export const Route = createFileRoute("/dodder")({ component: DodderPage });

function DodderPage() {
  return <Experience />;
}
