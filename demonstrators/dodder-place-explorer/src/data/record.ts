import { dodderPlace } from "@/data/dodder";

export type EvidenceCategory =
  | "water"
  | "wildlife"
  | "planning"
  | "people"
  | "designations"
  | "reports";

export const categoryOrder: EvidenceCategory[] = [
  "water",
  "wildlife",
  "planning",
  "people",
  "designations",
  "reports",
];

export type PlaceId = "company" | "woodland" | "wetland" | "dodder";

export type Lens =
  | "time"
  | "changed"
  | "said"
  | "evidence"
  | "since"
  | "together"
  | "landscape"
  | "engine"
  | "enquiry";

export type Review =
  | "Evidence located"
  | "Evidence changed"
  | "Evidence not located"
  | "Conflicting evidence"
  | "Human review required";

export type Tick = { short: string; long: string };

export type Evidence = {
  id: string;
  yearIndex: number;
  label: string;
  title: string;
  summary: string;
  excerpt: string;
  source: string;
  publisher: string;
  document: string;
  locator: string;
  published: string;
  eventDate: string;
  place: string;
  retrieved: string;
  review: Review;
  /** Set by an evidence pack. Inferred when a legacy record omits it. */
  category?: EvidenceCategory;
  x?: number;
  y?: number;
  afterStatement?: boolean;
};

export type ChainNode = {
  id: string;
  label: string;
  evidenceId?: string;
  laterId?: string;
  tone?: "gap" | "changed" | "live";
};

export type Statement = {
  id: string;
  yearIndex: number;
  when: string;
  document: string;
  locator: string;
  published: string;
  text: string;
  unchanged?: boolean;
  knownIds: string[];
};

export type Theme = { title: string; detail: string };

export type Origin = { title: string; detail: string };

export type PlaceModel = {
  id: PlaceId;
  name: string;
  siteLabel: string;
  siteMeta: string;
  banner: string;
  question: string;
  questionItalic: string;
  dek: string;
  timeCaption: string;
  playAllLabel: string;
  ticks: Tick[];
  earlyImage: string;
  lateImage?: string;
  imageAlt: string;
  site: { x: number; y: number };
  anchorYear: number;
  /** Evidence selected when the place is opened. */
  openingId?: string;
  disclosure?: { evidenceId: string };
  chain: ChainNode[];
  evidence: Evidence[];
  statements?: Statement[];
  themes: Theme[];
  themeLead: string;
  themeLine: string;
  whyLabel: string;
  sinceIds: string[];
  sinceFrom: number;
  sinceLead: string;
  sinceLine: string;
  sinceQuiet?: string;
  playFrom: number;
  playTo: number;
  revealAt: number;
  primaryAction: string;
  lenses: { changed: string; said: string; evidence: string };
  origins: Origin[];
  saidNote: string;
};

const retrieved = "Illustration only — not a retrieval";

export const records: Record<PlaceId, PlaceModel> = {
  company: {
    id: "company",
    name: "Example UK Listed Company",
    siteLabel: "Example Distribution Centre",
    siteMeta: "England",
    banner: "Illustrative example — not a real company or disclosure",
    question: "This place is changing.",
    questionItalic: "Does your annual report know?",
    dek: "Explore how evidence around one company site changes through time.",
    timeCaption: "Year",
    playAllLabel: "Let the years pass",
    ticks: [
      { short: "2021", long: "2021" },
      { short: "2022", long: "2022" },
      { short: "2023", long: "2023" },
      { short: "2024", long: "2024" },
      { short: "2025", long: "2025" },
      { short: "2026", long: "2026" },
    ],
    earlyImage: "/scenes/company-early.jpg",
    lateImage: "/scenes/company-late.jpg",
    imageAlt:
      "Illustrative aerial of a distribution centre beside a river, a road and patches of habitat in England. Not a real site.",
    site: { x: 43, y: 47 },
    anchorYear: 1,
    disclosure: { evidenceId: "disclosure-2022" },
    chain: [
      { id: "disclosure", label: "Climate disclosure", evidenceId: "disclosure-2022" },
      { id: "metric", label: "Target / metric", evidenceId: "metric-2022", tone: "gap" },
      { id: "site", label: "Physical site" },
      {
        id: "flood",
        label: "Flood evidence",
        evidenceId: "flood-2022",
        laterId: "flood-2025",
        tone: "changed",
      },
      { id: "rain", label: "Rainfall", evidenceId: "rain-2023" },
      { id: "drainage", label: "Drainage", evidenceId: "drainage-2024" },
      { id: "planning", label: "Planning / development", evidenceId: "planning-2024" },
      { id: "monitoring", label: "Monitoring", evidenceId: "monitor-2026", tone: "live" },
      { id: "later", label: "Later evidence", evidenceId: "monitor-2026", tone: "live" },
    ],
    evidence: [
      {
        id: "statement-2021",
        yearIndex: 0,
        label: "2021 statement",
        title: "Climate-risk statement published",
        summary:
          "An earlier illustrative climate-risk statement for priority sites. It is the first company document in this record.",
        excerpt:
          "Priority operational sites are included in the company’s climate-risk review. This sentence is illustrative. It is not taken from a filed report.",
        source: "Company climate-risk statement",
        publisher: "Example UK Listed Company",
        document: "Climate-risk statement 2021",
        locator: "p. 8",
        published: "November 2021",
        eventDate: "November 2021",
        place: "Example Distribution Centre — England",
        retrieved,
        review: "Evidence located",
        x: 54,
        y: 36,
      },
      {
        id: "disclosure-2022",
        yearIndex: 1,
        label: "2022 disclosure",
        title: "Annual report climate disclosure",
        summary:
          "The statement this demonstration follows. Later evidence is not used to decide whether it was right.",
        excerpt:
          "Physical climate risks to priority operational sites are monitored and managed.",
        source: "Company annual report",
        publisher: "Example UK Listed Company",
        document: "Annual Report 2022",
        locator: "p. 47",
        published: "March 2022",
        eventDate: "March 2022",
        place: "Example Distribution Centre — England",
        retrieved,
        review: "Evidence located",
        x: 43,
        y: 47,
      },
      {
        id: "metric-2022",
        yearIndex: 1,
        label: "Site metric",
        title: "Site-level physical-risk metric",
        summary:
          "The disclosure depends on monitoring. A metric for this particular site was not located in the illustrative public record.",
        excerpt:
          "No site-level physical-risk metric for Example Distribution Centre was located for this illustration.",
        source: "Company target note",
        publisher: "Example UK Listed Company",
        document: "Illustrative target note",
        locator: "Not located",
        published: "Not located",
        eventDate: "March 2022",
        place: "Example Distribution Centre — England",
        retrieved,
        review: "Evidence not located",
      },
      {
        id: "flood-2022",
        yearIndex: 1,
        label: "Flood dataset",
        title: "Flood-risk dataset updated",
        summary:
          "An illustrative public flood dataset is updated in September 2022, after the March annual report.",
        excerpt:
          "Illustrative flood extent, September 2022 edition. The site boundary used here is not a real mapped boundary.",
        source: "Public flood record",
        publisher: "Illustrative public flood record",
        document: "Illustrative flood dataset",
        locator: "Sheet 4",
        published: "September 2022",
        eventDate: "September 2022",
        place: "Example Distribution Centre — England",
        retrieved,
        review: "Evidence located",
        afterStatement: true,
        x: 30,
        y: 70,
      },
      {
        id: "rain-2023",
        yearIndex: 2,
        label: "Rainfall",
        title: "Extreme rainfall event recorded",
        summary: "An illustrative rainfall note records a heavy event at the catchment in August 2023.",
        excerpt:
          "12 August 2023. Illustrative rainfall total for the catchment. This is not a national weather archive extract.",
        source: "Climate observation",
        publisher: "Illustrative climate observation",
        document: "Illustrative rainfall note",
        locator: "Table 2",
        published: "October 2023",
        eventDate: "12 August 2023",
        place: "Catchment of Example Distribution Centre — England",
        retrieved,
        review: "Evidence located",
        x: 66,
        y: 30,
      },
      {
        id: "drainage-2024",
        yearIndex: 3,
        label: "Drainage",
        title: "Site drainage assessment published",
        summary: "An illustrative drainage assessment for the site is added to the record in 2024.",
        excerpt:
          "Illustrative drainage assessment. It describes ditches and outfalls around the distribution centre. It is not an engineering report.",
        source: "Site assessment",
        publisher: "Illustrative site assessment",
        document: "Illustrative drainage assessment",
        locator: "p. 3",
        published: "May 2024",
        eventDate: "May 2024",
        place: "Example Distribution Centre — England",
        retrieved,
        review: "Evidence located",
        x: 57,
        y: 74,
      },
      {
        id: "planning-2024",
        yearIndex: 3,
        label: "Planning",
        title: "Surrounding development noted",
        summary: "An illustrative planning note records development on land beside the site.",
        excerpt:
          "Illustrative planning note. New roofs appear at the edge of the nearby settlement in this demonstration. No real application is cited.",
        source: "Planning record",
        publisher: "Illustrative planning record",
        document: "Illustrative planning note",
        locator: "Note P-14",
        published: "August 2024",
        eventDate: "August 2024",
        place: "Land beside Example Distribution Centre — England",
        retrieved,
        review: "Evidence located",
        x: 76,
        y: 24,
      },
      {
        id: "conflict-2025",
        yearIndex: 4,
        label: "Boundary note",
        title: "Site boundary described two ways",
        summary:
          "The 2025 flood note and the 2022 dataset do not describe the site boundary in the same way. The difference is unresolved in this illustration.",
        excerpt:
          "Illustrative comparison. Two descriptions of the site boundary do not match. This is not a finding of fault.",
        source: "Public flood record",
        publisher: "Illustrative public flood record",
        document: "Illustrative boundary comparison",
        locator: "Note B-2",
        published: "June 2025",
        eventDate: "June 2025",
        place: "Example Distribution Centre — England",
        retrieved,
        review: "Conflicting evidence",
        x: 22,
        y: 56,
      },
      {
        id: "flood-2025",
        yearIndex: 4,
        label: "Flood update",
        title: "Flood-risk evidence changes",
        summary:
          "A later illustrative flood record draws the extent touching the site differently from the 2022 dataset.",
        excerpt:
          "Illustrative flood extent, 2025 edition. Compared with the 2022 sheet, the drawn extent at the site is not the same.",
        source: "Public flood record",
        publisher: "Illustrative public flood record",
        document: "Illustrative flood dataset, later edition",
        locator: "Sheet 4a",
        published: "June 2025",
        eventDate: "June 2025",
        place: "Example Distribution Centre — England",
        retrieved,
        review: "Evidence changed",
        x: 33,
        y: 60,
      },
      {
        id: "monitor-2026",
        yearIndex: 5,
        label: "Monitoring",
        title: "New monitoring evidence arrives",
        summary:
          "A monitoring note for the river bank arrives in 2026. It was not available when the 2022 disclosure was written. It has not been through review in this illustration.",
        excerpt:
          "Illustrative monitoring note, river bank, 2026. Marked for human review. It does not conclude that the disclosure was wrong.",
        source: "Environmental monitoring",
        publisher: "Illustrative monitoring record",
        document: "Illustrative monitoring note",
        locator: "Note M-6",
        published: "February 2026",
        eventDate: "February 2026",
        place: "River bank at Example Distribution Centre — England",
        retrieved,
        review: "Human review required",
        x: 48,
        y: 64,
      },
    ],
    statements: [
      {
        id: "s2022",
        yearIndex: 1,
        when: "2022",
        document: "Annual Report",
        locator: "p. 47",
        published: "March 2022",
        text: "Physical climate risks to priority operational sites are monitored and managed.",
        knownIds: ["statement-2021", "disclosure-2022", "metric-2022"],
      },
      {
        id: "s2023",
        yearIndex: 2,
        when: "2023",
        document: "Sustainability Report",
        locator: "p. 12",
        published: "April 2023",
        text: "Priority sites remain subject to periodic physical-risk review.",
        knownIds: ["statement-2021", "disclosure-2022", "metric-2022", "flood-2022"],
      },
      {
        id: "s2024",
        yearIndex: 3,
        when: "2024",
        document: "Climate Disclosure",
        locator: "p. 6",
        published: "June 2024",
        text: "Drainage and flood context at priority sites is kept under review.",
        knownIds: ["statement-2021", "disclosure-2022", "metric-2022", "flood-2022", "rain-2023", "drainage-2024"],
      },
      {
        id: "s2025",
        yearIndex: 4,
        when: "2025",
        document: "Annual Report",
        locator: "p. 52",
        published: "March 2025",
        text: "Physical climate risks to priority operational sites are monitored and managed.",
        unchanged: true,
        knownIds: [
          "statement-2021",
          "disclosure-2022",
          "metric-2022",
          "flood-2022",
          "rain-2023",
          "drainage-2024",
          "planning-2024",
        ],
      },
    ],
    themes: [
      {
        title: "Flood evidence changed",
        detail:
          "A later flood record does not read the same as the dataset published after the 2022 report. An extreme rainfall note sits between them.",
      },
      {
        title: "New monitoring evidence appeared",
        detail: "A 2026 monitoring note was not in the record when the disclosure was written.",
      },
      {
        title: "Site context changed",
        detail: "A drainage assessment and a nearby development note enter after the statement.",
      },
    ],
    themeLead: "3 things changed since this disclosure",
    themeLine: "These changes may affect how the earlier statement should be reviewed.",
    whyLabel: "Show me why",
    sinceIds: ["rain-2023", "drainage-2024", "flood-2025", "monitor-2026"],
    sinceFrom: 1,
    sinceLead: "4 relevant evidence changes found.",
    sinceLine: "These changes may be relevant when this disclosure is next reviewed.",
    sinceQuiet: "This is not a finding that the disclosure was wrong.",
    playFrom: 1,
    playTo: 5,
    revealAt: 5,
    primaryAction: "Show me what changed since we said this",
    lenses: {
      changed: "What changed?",
      said: "What did we say?",
      evidence: "Show me the evidence.",
    },
    origins: [
      { title: "Annual report", detail: "What the company said" },
      { title: "Public flood record", detail: "What a dataset recorded" },
      { title: "Planning evidence", detail: "What changed around the site" },
      { title: "Monitoring", detail: "What was measured later" },
      { title: "Climate observations", detail: "What the weather did" },
      { title: "Company target", detail: "What the statement depends on" },
    ],
    saidNote:
      "A historic statement is read against evidence that existed when it was made. Later evidence is shown so you can see what followed. It is not used to judge what the organisation could have known.",
  },
  woodland: {
    id: "woodland",
    name: "Example Woodland",
    siteLabel: "Example Woodland",
    siteMeta: "England",
    banner: "Illustrative place — not a real site or record",
    question: "What changed here",
    questionItalic: "this spring?",
    dek: "Moths, bats, rain, flowers, habitat, planning and surveys. Dated, and kept with the place.",
    timeCaption: "This spring",
    playAllLabel: "Let the spring pass",
    ticks: [
      { short: "Mar", long: "Early March" },
      { short: "Late", long: "Late March" },
      { short: "Apr", long: "April" },
      { short: "May", long: "May" },
      { short: "Jun", long: "June" },
      { short: "End", long: "Late June" },
    ],
    earlyImage: "/scenes/woodland.jpg",
    imageAlt: "Illustrative English woodland edge in early spring. Not a real surveyed site.",
    site: { x: 48, y: 58 },
    anchorYear: 0,
    chain: [
      { id: "moths", label: "Moths", evidenceId: "moth-mar" },
      { id: "bats", label: "Bats", evidenceId: "bat-mar" },
      { id: "rain", label: "Rainfall", evidenceId: "rain-apr" },
      { id: "flowers", label: "Flowers", evidenceId: "flower-may" },
      { id: "habitat", label: "Habitat", evidenceId: "habitat-jun" },
      { id: "planning", label: "Planning", evidenceId: "plan-jun" },
      { id: "survey", label: "Surveys", evidenceId: "survey-jun", tone: "live" },
    ],
    evidence: [
      {
        id: "moth-mar",
        yearIndex: 0,
        label: "Moths",
        title: "Early moth note",
        summary: "An illustrative moth list for the first mild nights of March.",
        excerpt: "Illustrative moth note, early March. Not a biological record centre extract.",
        source: "Species observation",
        publisher: "Illustrative species record",
        document: "Illustrative moth note",
        locator: "Visit 1",
        published: "Early March 2026",
        eventDate: "Early March 2026",
        place: "Example Woodland — England",
        retrieved,
        review: "Evidence located",
        x: 42,
        y: 62,
      },
      {
        id: "bat-mar",
        yearIndex: 1,
        label: "Bats",
        title: "Bat pass noted",
        summary: "A later March note records bat passes along the ride. The early moth note did not mention them.",
        excerpt: "Illustrative bat pass, late March, along the ride.",
        source: "Species observation",
        publisher: "Illustrative species record",
        document: "Illustrative bat note",
        locator: "Visit 2",
        published: "Late March 2026",
        eventDate: "Late March 2026",
        place: "Example Woodland — England",
        retrieved,
        review: "Evidence located",
        x: 58,
        y: 48,
      },
      {
        id: "rain-apr",
        yearIndex: 2,
        label: "Rain",
        title: "April rainfall note",
        summary: "An illustrative rainfall note for the wood, wetter than the early-spring visits.",
        excerpt: "Illustrative April rainfall at the woodland edge.",
        source: "Climate observation",
        publisher: "Illustrative climate observation",
        document: "Illustrative rainfall note",
        locator: "Table 1",
        published: "April 2026",
        eventDate: "April 2026",
        place: "Example Woodland — England",
        retrieved,
        review: "Evidence located",
        x: 70,
        y: 36,
      },
      {
        id: "flower-may",
        yearIndex: 3,
        label: "Flowers",
        title: "Flowering recorded",
        summary: "Flowering along the ride is noted in May. It is a record of what was seen, not a trend claim.",
        excerpt: "Illustrative flowering note, May, ride edge.",
        source: "Species observation",
        publisher: "Illustrative species record",
        document: "Illustrative flowering note",
        locator: "Visit 4",
        published: "May 2026",
        eventDate: "May 2026",
        place: "Example Woodland — England",
        retrieved,
        review: "Evidence located",
        x: 36,
        y: 70,
      },
      {
        id: "habitat-jun",
        yearIndex: 4,
        label: "Habitat",
        title: "Habitat condition note",
        summary: "A June note describes the ride and the canopy edge. It does not score the wood.",
        excerpt: "Illustrative habitat note. Ride open. Canopy edge intact in this illustration.",
        source: "Habitat note",
        publisher: "Illustrative habitat record",
        document: "Illustrative habitat note",
        locator: "p. 2",
        published: "June 2026",
        eventDate: "June 2026",
        place: "Example Woodland — England",
        retrieved,
        review: "Evidence located",
        x: 50,
        y: 40,
      },
      {
        id: "plan-jun",
        yearIndex: 5,
        label: "Planning",
        title: "Planning note at the edge",
        summary: "An illustrative planning note appears beside the wood late in the spring.",
        excerpt: "Illustrative planning note at the woodland edge. No real application is cited.",
        source: "Planning record",
        publisher: "Illustrative planning record",
        document: "Illustrative planning note",
        locator: "Note W-3",
        published: "Late June 2026",
        eventDate: "Late June 2026",
        place: "Edge of Example Woodland — England",
        retrieved,
        review: "Human review required",
        x: 74,
        y: 64,
      },
      {
        id: "survey-jun",
        yearIndex: 5,
        label: "Survey",
        title: "Repeat survey",
        summary: "A repeat walk records moths again. The list is not the same as early March.",
        excerpt: "Illustrative repeat moth list, late June. Differences from March are noted, not scored.",
        source: "Species survey",
        publisher: "Illustrative species record",
        document: "Illustrative repeat survey",
        locator: "Visit 6",
        published: "Late June 2026",
        eventDate: "Late June 2026",
        place: "Example Woodland — England",
        retrieved,
        review: "Evidence changed",
        x: 28,
        y: 46,
      },
    ],
    themes: [
      {
        title: "Species records changed",
        detail: "Bats appear in the later March note. The late-June moth list is not the March list.",
      },
      {
        title: "Rain and flowers were recorded",
        detail: "April rain and May flowering sit between the first visit and the repeat survey.",
      },
      {
        title: "A planning note appeared",
        detail: "Late in the spring, a planning note is recorded at the edge of the wood.",
      },
    ],
    themeLead: "3 things changed since early spring",
    themeLine: "The records are dated. Nothing here decides what the woodland should mean.",
    whyLabel: "Show the order",
    sinceIds: ["bat-mar", "rain-apr", "flower-may", "survey-jun"],
    sinceFrom: 0,
    sinceLead: "4 records followed the early-spring note.",
    sinceLine: "They sit on the same place, in the order they were recorded.",
    playFrom: 0,
    playTo: 5,
    revealAt: 5,
    primaryAction: "Show me this spring",
    lenses: {
      changed: "What changed?",
      said: "What was recorded first?",
      evidence: "Show me the evidence.",
    },
    origins: [
      { title: "Species notes", detail: "What was seen" },
      { title: "Rainfall", detail: "What the weather did" },
      { title: "Habitat note", detail: "How the ride was described" },
      { title: "Planning", detail: "What was proposed nearby" },
      { title: "Repeat survey", detail: "What the later walk recorded" },
      { title: "The place", detail: "The wood they all refer to" },
    ],
    saidNote:
      "An early note is read against what had been recorded by then. Later visits are shown afterwards. They are not used to rewrite the first visit.",
  },
  wetland: {
    id: "wetland",
    name: "Example Wetland",
    siteLabel: "Example Wetland",
    siteMeta: "England",
    banner: "Illustrative place — not a real site or record",
    question: "The water changed.",
    questionItalic: "What changed before it?",
    dek: "Rain, quality, birds, a licence, development, habitat and monitoring. In the order they were recorded.",
    timeCaption: "Before the change",
    playAllLabel: "Let the seasons pass",
    ticks: [
      { short: "Sum", long: "Last summer" },
      { short: "Aut", long: "Autumn" },
      { short: "Win", long: "Winter" },
      { short: "Spr", long: "Early spring" },
      { short: "Now", long: "The change" },
      { short: "After", long: "After" },
    ],
    earlyImage: "/scenes/wetland.jpg",
    imageAlt: "Illustrative lowland wetland with reeds and open water. Not a real surveyed site.",
    site: { x: 46, y: 54 },
    anchorYear: 4,
    chain: [
      { id: "habitat", label: "Protected habitat", evidenceId: "hab-sum" },
      { id: "birds", label: "Birds", evidenceId: "birds-aut" },
      { id: "licence", label: "Licence", evidenceId: "lic-win" },
      { id: "dev", label: "Development", evidenceId: "dev-win" },
      { id: "rain", label: "Rainfall", evidenceId: "rain-spr" },
      { id: "quality", label: "Water quality", evidenceId: "qual-now", tone: "changed" },
      { id: "mon", label: "Monitoring", evidenceId: "mon-after", tone: "live" },
    ],
    evidence: [
      {
        id: "hab-sum",
        yearIndex: 0,
        label: "Habitat",
        title: "Protected habitat record",
        summary: "An illustrative habitat record for the wetland, already on file last summer.",
        excerpt: "Illustrative habitat record. Not a designated-site citation.",
        source: "Habitat record",
        publisher: "Illustrative habitat record",
        document: "Illustrative habitat note",
        locator: "Sheet H",
        published: "August 2025",
        eventDate: "August 2025",
        place: "Example Wetland — England",
        retrieved,
        review: "Evidence located",
        x: 34,
        y: 48,
      },
      {
        id: "birds-aut",
        yearIndex: 1,
        label: "Birds",
        title: "Autumn bird count",
        summary: "An illustrative autumn count. It is a count, not an assessment of the water.",
        excerpt: "Illustrative autumn bird count at the open water.",
        source: "Species observation",
        publisher: "Illustrative species record",
        document: "Illustrative bird count",
        locator: "Visit A",
        published: "October 2025",
        eventDate: "October 2025",
        place: "Example Wetland — England",
        retrieved,
        review: "Evidence located",
        x: 60,
        y: 40,
      },
      {
        id: "lic-win",
        yearIndex: 2,
        label: "Licence",
        title: "Licence noted upstream",
        summary: "An illustrative licence is noted upstream of the wetland in winter.",
        excerpt: "Illustrative upstream licence. Not a real permit or abstraction licence.",
        source: "Licence record",
        publisher: "Illustrative licence record",
        document: "Illustrative licence note",
        locator: "Note L-1",
        published: "January 2026",
        eventDate: "January 2026",
        place: "Upstream of Example Wetland — England",
        retrieved,
        review: "Evidence located",
        x: 72,
        y: 28,
      },
      {
        id: "dev-win",
        yearIndex: 2,
        label: "Development",
        title: "Development note upstream",
        summary: "An illustrative development note is recorded in the same winter, upstream.",
        excerpt: "Illustrative development note. No real planning application is cited.",
        source: "Planning record",
        publisher: "Illustrative planning record",
        document: "Illustrative development note",
        locator: "Note D-4",
        published: "February 2026",
        eventDate: "February 2026",
        place: "Upstream of Example Wetland — England",
        retrieved,
        review: "Human review required",
        x: 78,
        y: 46,
      },
      {
        id: "rain-spr",
        yearIndex: 3,
        label: "Rain",
        title: "Spring rainfall",
        summary: "An illustrative rainfall note for the weeks before the water-quality sample.",
        excerpt: "Illustrative rainfall, early spring, before the sample.",
        source: "Climate observation",
        publisher: "Illustrative climate observation",
        document: "Illustrative rainfall note",
        locator: "Table 3",
        published: "March 2026",
        eventDate: "March 2026",
        place: "Example Wetland — England",
        retrieved,
        review: "Evidence located",
        x: 40,
        y: 30,
      },
      {
        id: "qual-now",
        yearIndex: 4,
        label: "Water",
        title: "Water quality sample differs",
        summary:
          "The illustrative sample does not read like the last summer description. That is a change in the record, not a cause.",
        excerpt:
          "Illustrative water-quality sample. It differs from the summer description in this demonstration. Cause is not assigned.",
        source: "Water observation",
        publisher: "Illustrative water record",
        document: "Illustrative water sample",
        locator: "Sample 9",
        published: "April 2026",
        eventDate: "April 2026",
        place: "Example Wetland — England",
        retrieved,
        review: "Evidence changed",
        x: 46,
        y: 54,
      },
      {
        id: "mon-after",
        yearIndex: 5,
        label: "Monitoring",
        title: "Follow-up monitoring",
        summary: "A later illustrative monitoring return. It arrives after the sample.",
        excerpt: "Illustrative monitoring return after the sample. Marked for human review.",
        source: "Environmental monitoring",
        publisher: "Illustrative monitoring record",
        document: "Illustrative monitoring return",
        locator: "Return 2",
        published: "May 2026",
        eventDate: "May 2026",
        place: "Example Wetland — England",
        retrieved,
        review: "Human review required",
        x: 58,
        y: 68,
      },
    ],
    themes: [
      {
        title: "Rain was already on the record",
        detail: "A spring rainfall note is dated before the sample.",
      },
      {
        title: "Upstream notes existed",
        detail: "A licence and a development note are recorded upstream, earlier in the year.",
      },
      {
        title: "The sample is the change",
        detail: "The water-quality sample differs from the summer description. Monitoring follows it.",
      },
    ],
    themeLead: "What was already recorded",
    themeLine: "These came before the sample. They do not, by themselves, explain the water.",
    whyLabel: "Show what came before",
    sinceIds: ["birds-aut", "lic-win", "dev-win", "rain-spr"],
    sinceFrom: -1,
    sinceLead: "4 records were already there.",
    sinceLine: "The water is not the first thing in the record.",
    playFrom: 0,
    playTo: 4,
    revealAt: 4,
    primaryAction: "Show me what changed before it",
    lenses: {
      changed: "What changed?",
      said: "What came before?",
      evidence: "Show me the evidence.",
    },
    origins: [
      { title: "Habitat record", detail: "What the place was called" },
      { title: "Bird count", detail: "What was seen on the water" },
      { title: "Licence", detail: "What was noted upstream" },
      { title: "Development", detail: "What was proposed upstream" },
      { title: "Rainfall", detail: "What fell before the sample" },
      { title: "Water sample", detail: "What the sample recorded" },
    ],
    saidNote:
      "Each note is kept at its own date. A later sample is not used to rewrite what the earlier notes said.",
  },
  dodder: dodderPlace,
};

export const placeOrder: PlaceId[] = ["dodder", "company", "woodland", "wetland"];

export function evidenceCategory(item: Evidence): EvidenceCategory {
  if (item.category) return item.category;
  const blob = `${item.id} ${item.label} ${item.title} ${item.source}`.toLowerCase();
  if (/bird|otter|wildlife|species|moth|bat|flora|fauna|flower/.test(blob)) return "wildlife";
  if (/habitat|designat|sac|natura|sssi|protected/.test(blob)) return "designations";
  if (/plan|develop/.test(blob)) return "planning";
  if (/flood|rain|water|drain|river|qual|licen/.test(blob)) return "water";
  if (/statement|disclos|people|community|company|metric|target/.test(blob)) return "people";
  return "reports";
}

export function reviewKey(review: Review): string {
  switch (review) {
    case "Evidence located":
      return "located";
    case "Evidence changed":
      return "changed";
    case "Evidence not located":
      return "missing";
    case "Conflicting evidence":
      return "conflict";
    case "Human review required":
      return "review";
  }
}

export function evidenceById(place: PlaceModel, id: string | null | undefined) {
  if (!id) return undefined;
  return place.evidence.find((item) => item.id === id);
}

export function visibleEvidence(place: PlaceModel, year: number) {
  return place.evidence.filter((item) => item.yearIndex <= year);
}

export function sinceVisible(place: PlaceModel, year: number) {
  return place.sinceIds
    .map((id) => place.evidence.find((item) => item.id === id))
    .filter((item): item is Evidence => !!item && item.yearIndex > place.sinceFrom && item.yearIndex <= year);
}

export type ChainState = "dim" | "lit" | "gap" | "changed" | "live";

export function chainState(place: PlaceModel, node: ChainNode, year: number): ChainState {
  const current = node.evidenceId ? evidenceById(place, node.evidenceId) : undefined;
  const later = node.laterId ? evidenceById(place, node.laterId) : undefined;
  if (current && current.yearIndex > year) return "dim";
  if (node.tone === "gap") return year >= (current?.yearIndex ?? 0) ? "gap" : "dim";
  if (node.tone === "live") return current && current.yearIndex <= year ? "live" : "dim";
  if (node.tone === "changed") {
    if (later && later.yearIndex <= year) return "changed";
    if (current && current.yearIndex <= year) return "lit";
    return "dim";
  }
  return "lit";
}
