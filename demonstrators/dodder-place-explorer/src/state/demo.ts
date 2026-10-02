import { create } from "zustand";
import { records, type Lens, type PlaceId } from "@/data/record";

export type Moment = "before" | "connected" | "since" | "sources" | "notice" | "engine";

type Demo = {
  placeId: PlaceId;
  year: number;
  lens: Lens;
  selectedId: string | null;
  sourceId: string | null;
  enquiryKind: "disclosure" | "place";
  idle: boolean;
  setYear: (year: number) => void;
  setLens: (lens: Lens) => void;
  setPlace: (placeId: PlaceId) => void;
  select: (id: string | null) => void;
  openSource: (id: string) => void;
  closeSource: () => void;
  openEnquiry: (kind: "disclosure" | "place") => void;
  jump: (moment: Moment) => void;
  touch: () => void;
};

function endSelection(placeId: PlaceId) {
  const place = records[placeId];
  return place.openingId ?? place.disclosure?.evidenceId ?? place.evidence.at(-1)?.id ?? null;
}

export const useDemo = create<Demo>((set) => ({
  placeId: "dodder",
  year: 6,
  lens: "time",
  selectedId: "anglesea-2026",
  sourceId: null,
  enquiryKind: "disclosure",
  idle: true,
  setYear: (year) =>
    set((state) => {
      const max = records[state.placeId].ticks.length - 1;
      return { year: Math.min(max, Math.max(0, year)), idle: false };
    }),
  setLens: (lens) => set({ lens }),
  setPlace: (placeId) =>
    set({
      placeId,
      year: records[placeId].ticks.length - 1,
      lens: "time",
      selectedId: endSelection(placeId),
      sourceId: null,
      idle: false,
    }),
  select: (selectedId) => set({ selectedId }),
  openSource: (sourceId) => set({ sourceId }),
  closeSource: () => set({ sourceId: null }),
  openEnquiry: (enquiryKind) => set({ enquiryKind, lens: "enquiry", idle: false }),
  touch: () => set({ idle: false }),
  jump: (moment) => {
    if (moment === "engine") {
      set({ lens: "engine", idle: false, sourceId: null });
      return;
    }
    const base = {
      placeId: "company" as const,
      idle: false,
      sourceId: null,
    };
    if (moment === "notice") {
      set({ ...base, year: 5, lens: "landscape", selectedId: "disclosure-2022" });
      return;
    }
    if (moment === "before") {
      set({ ...base, year: 0, lens: "time", selectedId: "statement-2021" });
      return;
    }
    if (moment === "connected") {
      set({ ...base, year: 5, lens: "time", selectedId: "disclosure-2022" });
      return;
    }
    if (moment === "since") {
      set({ ...base, year: 5, lens: "since", selectedId: "monitor-2026" });
      return;
    }
    set({ ...base, year: 5, lens: "evidence", selectedId: "disclosure-2022" });
  },
}));
