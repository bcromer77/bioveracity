import { records } from "@/data/record";
import { useDemo } from "@/state/demo";
import { PlaceExplorer } from "@/components/place-explorer";

export function Experience() {
  const placeId = useDemo((s) => s.placeId);
  return <PlaceExplorer place={records[placeId]} />;
}
