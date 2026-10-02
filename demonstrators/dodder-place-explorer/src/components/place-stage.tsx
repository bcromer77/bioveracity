import type { ReactNode } from "react";
import { Droplets, FileText, Landmark, Leaf, Shield, Users } from "lucide-react";
import { evidenceCategory, sinceVisible, type EvidenceCategory, type PlaceModel } from "@/data/record";
import { useDemo } from "@/state/demo";

const catIcon = {
  water: Droplets,
  wildlife: Leaf,
  planning: Landmark,
  people: Users,
  designations: Shield,
  reports: FileText,
} as const;

export function PlaceStage({
  place,
  onPick,
  layer,
  children,
}: {
  place: PlaceModel;
  onPick: (id: string) => void;
  layer: EvidenceCategory | "all";
  children?: ReactNode;
}) {
  const year = useDemo((s) => s.year);
  const lens = useDemo((s) => s.lens);
  const selectedId = useDemo((s) => s.selectedId);
  const showTrace = !!place.disclosure && year >= place.anchorYear;
  const lateOn = !!place.lateImage && year >= place.ticks.length - 1;
  const spotlight =
    lens === "since" ? (sinceVisible(place, year).at(-1)?.id ?? selectedId) : selectedId;

  const visible = place.evidence.filter(
    (item) =>
      item.x != null &&
      item.y != null &&
      item.yearIndex <= year &&
      (layer === "all" || evidenceCategory(item) === layer),
  );
  const cardable = visible.filter((item) => item.y != null && item.y >= 34 && item.y <= 82);
  const featuredIds: string[] = [];
  const prefer = cardable.find((item) => item.id === spotlight) ?? [...cardable].reverse()[0];
  if (prefer) featuredIds.push(prefer.id);
  for (const item of [...cardable].reverse()) {
    if (featuredIds.length >= 1) break;
    if (featuredIds.includes(item.id)) continue;
    const clash = featuredIds.some((id) => {
      const other = cardable.find((candidate) => candidate.id === id);
      if (!other || other.x == null || other.y == null || item.x == null || item.y == null) return false;
      const dy = Math.abs((other.y ?? 0) - (item.y ?? 0));
      if (dy < 16) return true;
      return Math.hypot((other.x ?? 0) - (item.x ?? 0), dy) < 24;
    });
    if (!clash) featuredIds.push(item.id);
  }

  return (
    <div className="stage" aria-label={place.siteLabel}>
      {place.id === "dodder" ? (
        <DodderPlate />
      ) : (
        <>
          <img className="stage-photo" src={place.earlyImage} alt={place.imageAlt} />
          {place.lateImage ? (
            <img
              className={lateOn ? "stage-photo late is-on" : "stage-photo late"}
              src={place.lateImage}
              alt=""
            />
          ) : null}
        </>
      )}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className={showTrace ? "trace is-on" : "trace"}
          pathLength={1}
          d={`M 97 38 C 78 34, 62 42, ${place.site.x} ${place.site.y}`}
        />
      </svg>
      {place.evidence.map((item) => {
        if (item.x == null || item.y == null) return null;
        const inYear = item.yearIndex <= year;
        const inLayer = layer === "all" || evidenceCategory(item) === layer;
        const shown = inYear && inLayer;
        const selected = item.id === spotlight && shown;
        const category = evidenceCategory(item);
        const Icon = catIcon[category];
        return (
          <button
            key={item.id}
            type="button"
            className="mark"
            data-cat={category}
            data-show={shown ? "true" : "false"}
            data-selected={selected ? "true" : "false"}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            aria-hidden={shown ? undefined : true}
            aria-label={`${item.title}. ${item.eventDate}. ${item.review}. ${place.id === "dodder" ? "Retrieved record." : "Illustrative evidence."}`}
            tabIndex={shown ? 0 : -1}
            onClick={() => shown && onPick(item.id)}
          >
            <span className="mark-dot">
              <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
            </span>
            {shown && featuredIds.includes(item.id) ? (
              <span className="mark-card" data-side={item.x > 60 ? "left" : "right"}>
                <span className="mark-kicker">{item.label}</span>
                <span className="mark-title">{item.title}</span>
                <span className="mark-meta">{item.publisher}</span>
                <span className="mark-date">{item.eventDate}</span>
              </span>
            ) : null}
          </button>
        );
      })}
      {children}
      <p className="map-caption">{place.id === "dodder" ? "Schematic · not a survey · not to scale" : "Illustrative · not to scale"}</p>
      <p className="sr-only">
        {place.id === "dodder"
          ? `${visible.length} retrieved records are on the plate at this point in time.`
          : `${visible.length} illustrative evidence items are on the place at this point in time.`}
      </p>
    </div>
  );
}

function DodderPlate() {
  return (
    <svg
      className="stage-photo"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Schematic plate of the River Dodder. Not a survey, not a flood map, and not to scale."
    >
      <rect width="100" height="100" fill="#f6f7f4" />
      <path d="M0 18 C 18 14, 28 26, 46 20 S 78 8, 100 16" fill="none" stroke="#e6e4da" strokeWidth="0.35" />
      <path d="M0 30 C 20 26, 34 38, 58 32 S 82 22, 100 28" fill="none" stroke="#e6e4da" strokeWidth="0.28" />
      <path d="M0 70 C 22 78, 40 66, 68 74 S 88 86, 100 78" fill="none" stroke="#e7e5db" strokeWidth="0.28" />
      <path d="M0 8 C 14 22, 8 40, 2 52 C 10 36, 4 20, 0 8 Z" fill="#e4efe8" />
      <path d="M0 14 C 22 8, 16 28, 6 36 C 18 22, 10 12, 0 14 Z" fill="#d5e6dc" opacity="0.85" />
      <path d="M100 24 C 86 18, 90 40, 100 52 C 92 40, 94 28, 100 24 Z" fill="#e4eef2" />
      <path d="M72 6 C 84 10, 96 8, 100 14 L 100 6 Z" fill="#e7f1f4" />
      <path
        d="M70 4 C 78 12, 88 11, 96 16"
        fill="none"
        stroke="#b7c9ce"
        strokeWidth="0.55"
        strokeLinecap="round"
      />
      <path
        d="M0 64 C 18 70, 26 52, 42 50 C 58 48, 62 62, 76 66 C 86 69, 92 58, 100 52"
        fill="none"
        stroke="#c5d9cf"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M0 64 C 18 70, 26 52, 42 50 C 58 48, 62 62, 76 66 C 86 69, 92 58, 100 52"
        fill="none"
        stroke="#1b3a2e"
        strokeWidth="0.55"
        strokeLinecap="round"
      />
    </svg>
  );
}
