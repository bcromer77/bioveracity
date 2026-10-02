import { createFileRoute } from "@tanstack/react-router";
import { SalmonJourney } from "@/components/salmon-journey";

export const Route = createFileRoute("/salmon")({
  component: SalmonPage,
  head: () => ({
    meta: [
      { title: "Where did Ireland’s salmon go?" },
      {
        name: "description",
        content: "One man’s proposition. Decades of evidence. Explore it yourself.",
      },
    ],
  }),
});

function SalmonPage() {
  return <SalmonJourney />;
}
