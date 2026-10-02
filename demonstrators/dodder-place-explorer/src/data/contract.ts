import {
  categoryOrder,
  evidenceCategory,
  type EvidenceCategory,
  type PlaceModel,
  type Review,
} from "@/data/record";

/**
 * Evidence packs are data. PlaceExplorer is the experience.
 * A pack never asks the component to be rewritten for another river.
 * Correlation is not causation: relationships carry a basis, never a cause.
 */

export type EvidenceStatus =
  | "located"
  | "changed"
  | "not_located"
  | "conflicting"
  | "human_review";

export type RelationshipType = "temporal" | "spatial" | "documentary" | "unresolved";

export type PlaceEvent = {
  id: string;
  yearIndex: number;
  eventDate: string;
  publicationDate: string;
  category: EvidenceCategory;
  coordinates?: { x: number; y: number };
  title: string;
  description: string;
  excerpt: string;
  sourceId: string;
  evidenceStatus: EvidenceStatus;
  reviewLabel: Review;
  label: string;
};

export type PlaceSource = {
  id: string;
  publisher: string;
  title: string;
  /** Null while a record is illustrative and has no filed URL. */
  url: string | null;
  locator: string;
  publicationDate: string;
  retrievalDate: string;
  place: string;
};

export type PlaceRelationship = {
  id: string;
  label: string;
  evidenceA?: string;
  evidenceB?: string;
  type: RelationshipType;
  /** Why these records are shown together. Must not assert cause. */
  basis: string;
};

export type PlaceMedia = {
  id: string;
  src: string;
  alt: string;
  licence: string;
  attribution: string;
};

export type PlacePack = {
  id: string;
  name: string;
  location: string;
  kicker: string;
  headline: string;
  headlineItalic: string;
  summary: string;
  notice: string;
  geography: {
    label: string;
    /** Plate position in this demonstrator. A live pack would use lng/lat. */
    anchor?: { x: number; y: number };
    bounds?: [[number, number], [number, number]];
  };
  map: {
    earlyImage: string;
    lateImage?: string;
    imageAlt: string;
    attribution: string;
  };
  timeline: {
    start: string;
    end: string;
    ticks: { label: string; long: string }[];
  };
  layers: EvidenceCategory[];
  events: PlaceEvent[];
  sources: PlaceSource[];
  relationships: PlaceRelationship[];
  media: PlaceMedia[];
};

const BASIS =
  "These records share this illustration’s place and time window. They may be related and require review. No cause is assigned.";

export function statusOf(review: Review): EvidenceStatus {
  switch (review) {
    case "Evidence located":
      return "located";
    case "Evidence changed":
      return "changed";
    case "Evidence not located":
      return "not_located";
    case "Conflicting evidence":
      return "conflicting";
    case "Human review required":
      return "human_review";
  }
}

export function projectPlace(place: PlaceModel): PlacePack {
  const events: PlaceEvent[] = place.evidence.map((item) => ({
    id: item.id,
    yearIndex: item.yearIndex,
    eventDate: item.eventDate,
    publicationDate: item.published,
    category: evidenceCategory(item),
    coordinates: item.x != null && item.y != null ? { x: item.x, y: item.y } : undefined,
    title: item.title,
    description: item.summary,
    excerpt: item.excerpt,
    sourceId: item.id,
    evidenceStatus: statusOf(item.review),
    reviewLabel: item.review,
    label: item.label,
  }));

  const sources: PlaceSource[] = place.evidence.map((item) => ({
    id: item.id,
    publisher: item.publisher,
    title: item.document,
    url: null,
    locator: item.locator,
    publicationDate: item.published,
    retrievalDate: item.retrieved,
    place: item.place,
  }));

  const relationships: PlaceRelationship[] = place.chain
    .filter((node) => node.evidenceId)
    .map((node) => ({
      id: node.id,
      label: node.label,
      evidenceA: node.evidenceId,
      evidenceB: node.laterId,
      type: node.tone === "gap" ? "unresolved" : node.laterId ? "temporal" : "documentary",
      basis: BASIS,
    }));

  const layers = categoryOrder.filter((category) => events.some((event) => event.category === category));
  const ticks = place.ticks;

  return {
    id: place.id,
    name: place.name,
    location: place.siteMeta,
    kicker: `${place.siteLabel} — ${place.siteMeta}`,
    headline: place.question,
    headlineItalic: place.questionItalic,
    summary: place.dek,
    notice: place.banner,
    geography: {
      label: place.siteLabel,
      anchor: place.site,
    },
    map: {
      earlyImage: place.earlyImage,
      lateImage: place.lateImage,
      imageAlt: place.imageAlt,
      attribution: "Illustrative aerial · not a survey and not to scale",
    },
    timeline: {
      start: ticks[0]?.long ?? "",
      end: ticks[ticks.length - 1]?.long ?? "",
      ticks: ticks.map((tick) => ({ label: tick.short, long: tick.long })),
    },
    layers,
    events,
    sources,
    relationships,
    media: [
      {
        id: "early",
        src: place.earlyImage,
        alt: place.imageAlt,
        licence: "Demonstration imagery",
        attribution: "Illustrative scene generated for this demonstrator. Not a licensed survey photograph.",
      },
      ...(place.lateImage
        ? [
            {
              id: "late",
              src: place.lateImage,
              alt: "",
              licence: "Demonstration imagery",
              attribution: "Illustrative later scene. Not a licensed survey photograph.",
            },
          ]
        : []),
    ],
  };
}

export function sourceById(pack: PlacePack, id: string | undefined) {
  if (!id) return undefined;
  return pack.sources.find((source) => source.id === id);
}

export function eventsAt(pack: PlacePack, year: number, layer: EvidenceCategory | "all") {
  return pack.events.filter(
    (event) => event.yearIndex <= year && (layer === "all" || event.category === layer),
  );
}
