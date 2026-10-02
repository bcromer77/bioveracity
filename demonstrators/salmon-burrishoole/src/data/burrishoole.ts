export type FamilyId =
  | "salmon"
  | "water"
  | "invertebrates"
  | "weather"
  | "status"
  | "barriers"
  | "waste"
  | "nature"
  | "bats"
  | "deer"
  | "birds";

export type EvidenceClass =
  | "Repeated measurement"
  | "Structured survey"
  | "Regulatory assessment"
  | "Infrastructure snapshot"
  | "Occurrence record"
  | "Evidence gap";

export type YearStop = 1970 | 2007 | 2018 | 2022 | 2025;

export const years: YearStop[] = [1970, 2007, 2018, 2022, 2025];

export type Family = {
  id: FamilyId;
  name: string;
  klass: EvidenceClass;
  optional: boolean;
  line: "series" | "mark" | "none";
  from?: YearStop;
  to?: YearStop;
  speak: string;
  why: string;
  source: string;
  url: string;
  retrieved: string;
};

export const families: Family[] = [
  {
    id: "salmon",
    name: "Salmon",
    klass: "Repeated measurement",
    optional: false,
    line: "series",
    from: 1970,
    to: 2025,
    speak: "The Marine Institute describes a full count of fish moving up and down at Burrishoole since 1970. The traps have operated since 1958. This page does not draw the yearly numbers. The public dashboard is a recent year, and it is labelled raw.",
    why: "A census of this system. Not a census of Ireland.",
    source: "Marine Institute, Wild Salmon Census and Newport facilities",
    url: "https://marine.ie/site-area/areas-activity/fisheries-ecosystems/wild-salmon-census",
    retrieved: "2 October 2026",
  },
  {
    id: "water",
    name: "Water",
    klass: "Repeated measurement",
    optional: true,
    line: "mark",
    from: 2025,
    to: 2025,
    speak: "Two buoys, on Lough Feeagh and Lough Furnace, are described as sending a measurement about every two minutes. The year that archive begins was not opened. A minute is not a year, and a lake is not every stream.",
    why: "An instrument. Not a line back to 1970.",
    source: "Marine Institute, Newport catchment facilities",
    url: "https://marine.ie/site-area/infrastructure-facilities/newport-catchment-facilities/newport-catchment-facilities",
    retrieved: "2 October 2026",
  },
  {
    id: "invertebrates",
    name: "Invertebrates",
    klass: "Structured survey",
    optional: true,
    line: "series",
    from: 2007,
    to: 2018,
    speak: "The EPA’s river invertebrate scores have a published digital series from 2007 to 2018. Paper surveys go back to 1971 and were not drawn, because they are not the same digital series. The Burrishoole station values were not opened. The line stops in 2018 because that published series stops, not because the insects vanished. EPA monitoring itself did not end there.",
    why: "A score of a sample. Not a count of insects in weed.",
    source: "EPA river invertebrate data, described in Scientific Data, 2020",
    url: "https://www.nature.com/articles/s41597-020-00618-8",
    retrieved: "2 October 2026",
  },
  {
    id: "weather",
    name: "Weather",
    klass: "Repeated measurement",
    optional: true,
    line: "series",
    from: 1970,
    to: 2025,
    speak: "Met Éireann keeps daily rain and temperature at its stations. The nearest synoptic station is not in this catchment. A wet day there is not a flood here unless a gauge in the river says so.",
    why: "A real series, in the wrong place to stand for the lake.",
    source: "Met Éireann, historical observations",
    url: "https://www.met.ie/climate/available-data/",
    retrieved: "2 October 2026",
  },
  {
    id: "status",
    name: "Water status",
    klass: "Regulatory assessment",
    optional: true,
    line: "mark",
    from: 2025,
    to: 2025,
    speak: "The EPA’s Water Framework Directive record is a status for a cycle, not a daily line. A water body that was not assessed is not a clean one. No Burrishoole status figure was opened for this page.",
    why: "A judgement for a cycle. Not a measurement every year.",
    source: "EPA WFD open data",
    url: "https://data.epa.ie/api-list/wfd-open-data/",
    retrieved: "2 October 2026",
  },
  {
    id: "barriers",
    name: "Barriers",
    klass: "Infrastructure snapshot",
    optional: true,
    line: "mark",
    from: 2025,
    to: 2025,
    speak: "Inland Fisheries Ireland maps barriers and, from 2024, mitigation projects. A dot on that map does not say when the barrier began, or whether it changed the fish. An empty square was not proved empty.",
    why: "A place. Not a date of effect.",
    source: "Inland Fisheries Ireland, National Barriers Programme. CC BY 4.0.",
    url: "https://opendata-ifigeo.hub.arcgis.com/datasets/ifigeo::national-barriers-programme-dataset",
    retrieved: "2 October 2026",
  },
  {
    id: "waste",
    name: "Wastewater",
    klass: "Infrastructure snapshot",
    optional: true,
    line: "mark",
    from: 2022,
    to: 2022,
    speak: "Uisce Éireann’s public list of treatment plants and pumping stations was last updated in December 2023. It says where the works are. It does not say what left the pipe, or when. A point is not a spill.",
    why: "Infrastructure. Not an event.",
    source: "Uisce Éireann open data, plants list",
    url: "https://www.water.ie/open-data",
    retrieved: "2 October 2026",
  },
  {
    id: "nature",
    name: "Protected nature",
    klass: "Regulatory assessment",
    optional: true,
    line: "mark",
    from: 2025,
    to: 2025,
    speak: "NPWS publishes the line of a protected site and the species and habitats named for it. Crossing that line is a legal fact. It is not evidence that the habitat got better.",
    why: "A boundary. Not a recovery.",
    source: "National Parks and Wildlife Service, designated-site data",
    url: "https://www.npws.ie/maps-and-data/designated-site-data/download-boundary-data",
    retrieved: "2 October 2026",
  },
  {
    id: "bats",
    name: "Bats",
    klass: "Evidence gap",
    optional: true,
    line: "none",
    speak: "Bat Conservation Ireland counts Daubenton’s bat passes along a kilometre of water in August. That survey runs nationally from 2006 to 2021. A repeated Burrishoole stretch was not established. Fewer casual records would not mean fewer bats.",
    why: "A method exists. This place was not shown to have been walked the same way twice.",
    source: "All-Ireland Daubenton’s Bat Waterways Survey, via the National Biodiversity Data Centre",
    url: "https://maps.biodiversityireland.ie/Dataset/128/Survey/268",
    retrieved: "2 October 2026",
  },
  {
    id: "deer",
    name: "Deer",
    klass: "Evidence gap",
    optional: true,
    line: "none",
    speak: "Deer records say an animal was reported. They do not say how many were there, or that anyone looked when none were seen. A drop in records is not a drop in deer.",
    why: "Occurrence is not abundance.",
    source: "National Biodiversity Data Centre records, and the SMARTDEER collation",
    url: "https://maps.biodiversityireland.ie/",
    retrieved: "2 October 2026",
  },
  {
    id: "birds",
    name: "Starlings",
    klass: "Evidence gap",
    optional: true,
    line: "none",
    speak: "No series of murmurations was located. Starling is not among the 44 species in the published Countryside Bird Index. Winter waterbird counts exist for other species, at other wetlands. They were not opened for this catchment.",
    why: "A story about birds is not a count.",
    source: "Countryside Bird Survey, BirdWatch Ireland",
    url: "https://countrysidebirdsurvey.ie/",
    retrieved: "2 October 2026",
  },
];

export const overlap =
  "These records overlap in place and time. The evidence reviewed does not establish that one caused another.";

export type Ask = { id: string; q: string };

export const catchmentAsks: Ask[] = [
  { id: "fell", q: "What changed when salmon survival fell?" },
  { id: "same", q: "What else was measured at the same time?" },
  { id: "warm", q: "Was the water warmer?" },
  { id: "invert", q: "What happened to invertebrate condition?" },
  { id: "bats", q: "Were there fewer bats?" },
  { id: "barriers", q: "Did barriers cause the decline?" },
  { id: "missing", q: "What evidence is missing?" },
  { id: "stopped", q: "What stopped being measured?" },
  { id: "now", q: "What do we know now that wasn’t known then?" },
];
