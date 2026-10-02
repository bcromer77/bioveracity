import { createFileRoute } from "@tanstack/react-router";
import { ScienceMemory } from "@/components/science-memory";

export const Route = createFileRoute("/cambridge")({
  component: CambridgePage,
  head: () => ({
    meta: [{ title: "Cherry Hinton Brook — the record of the science" }],
  }),
});

function CambridgePage() {
  return <ScienceMemory />;
}
