import type { Moment } from "@/state/demo";
import { useDemo } from "@/state/demo";
import type { PlaceModel } from "@/data/record";

const moments: { id: Moment; label: string }[] = [
  { id: "before", label: "The place" },
  { id: "connected", label: "Connected" },
  { id: "since", label: "What changed" },
  { id: "sources", label: "Sources" },
  { id: "notice", label: "Notice" },
  { id: "engine", label: "Another place" },
];

export function TimeBar({
  place,
  onYear,
  onPlayAll,
  variant = "map",
}: {
  place: PlaceModel;
  onYear: (year: number) => void;
  onPlayAll: () => void;
  variant?: "map" | "moments";
}) {
  const year = useDemo((s) => s.year);
  const lens = useDemo((s) => s.lens);
  const placeId = useDemo((s) => s.placeId);
  const idle = useDemo((s) => s.idle);
  const jump = useDemo((s) => s.jump);
  const max = place.ticks.length - 1;
  const fill = max === 0 ? "100%" : `${(year / max) * 100}%`;
  const current = place.ticks[year];

  const currentMoment = (() => {
    if (lens === "engine") return "engine";
    if (lens === "landscape") return "notice";
    if (placeId !== "company") return null;
    if (lens === "evidence") return "sources";
    if (lens === "since") return "since";
    if (lens === "time" && year === 0) return "before";
    if (lens === "time" && year === max) return "connected";
    return null;
  })();

  if (variant === "moments") {
    return (
      <div className="moment-row">
        <p className="proposed">In this demonstration</p>
        <div className="moments" aria-label="Moments in this demonstration">
          {moments.map((moment) => (
            <button
              key={moment.id}
              type="button"
              className="moment"
              aria-current={currentMoment === moment.id ? "true" : undefined}
              onClick={() => jump(moment.id)}
            >
              {moment.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`map-time ${idle ? "is-idle" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="map-time-title">Travel through time</p>
        <button type="button" className="map-play" onClick={onPlayAll} aria-label={place.playAllLabel}>
          Play
        </button>
      </div>
      <label className="sr-only" htmlFor="time-slider">
        {place.timeCaption}. Currently {current?.long}.
      </label>
      <input
        id="time-slider"
        className="time-range"
        type="range"
        min={0}
        max={max}
        step={1}
        value={year}
        style={{ ["--fill" as string]: fill }}
        aria-valuetext={current?.long}
        onChange={(event) => onYear(Number(event.target.value))}
      />
      <div
        className="tick-row"
        style={{ gridTemplateColumns: `repeat(${place.ticks.length}, minmax(0, 1fr))` }}
      >
        {place.ticks.map((tick, index) => (
          <button
            key={tick.long}
            type="button"
            data-on={index === year ? "true" : "false"}
            aria-label={tick.long}
            aria-pressed={index === year}
            onClick={() => onYear(index)}
          >
            {tick.short}
          </button>
        ))}
      </div>
    </div>
  );
}
