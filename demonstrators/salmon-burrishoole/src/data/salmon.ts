export type Stage = "stream" | "river" | "estuary" | "ocean" | "return";
export type When = "then" | "latest";

export type SalCard = {
  id: string;
  stage: Stage;
  when: When;
  kicker: string;
  text: string;
  source: string;
  url: string;
  published: string;
  limit: string;
};

export const retrieved = "2 October 2026";

export const grubbUrl =
  "https://salmonwatchireland.ie/2022/05/13/arather-unique-and-interesting-point-of-view-regenerating-our-salmon-and-rivers-by-nicolas-grubb/";
export const tegos2022 =
  "https://www.fisheriesireland.ie/sites/default/files/2022-01/the-status-of-irish-salmon-stocks-in-2021-with-catch-advice-for-2022.pdf";
export const tegos2025 =
  "https://www.fisheriesireland.ie/sites/default/files/2025-12/The%20Status%20of%20Irish%20Salmon%20Stocks%20in%202025%20with%20Catch%20Advice%20for%202026.pdf";

export const stages: { id: Stage; place: string; ask: string }[] = [
  { id: "stream", place: "Stream", ask: "What gives a young salmon a chance?" },
  { id: "river", place: "River", ask: "What helps or obstructs the journey?" },
  { id: "estuary", place: "Estuary", ask: "What changes where the river meets the sea?" },
  { id: "ocean", place: "Ocean", ask: "What happens after the salmon leaves Ireland?" },
  { id: "return", place: "Return", ask: "How many make it home?" },
];

export const cards: SalCard[] = [
  {
    id: "shade",
    stage: "stream",
    when: "then",
    kicker: "Author’s proposition",
    text: "Nicholas Grubb wrote that shallow water needs light, and that the plant crowfoot (Ranunculus) carries the insect life young salmon depend on. He said water less than a metre deep should be at least two-thirds open to the sun, and that most spawning streams in the big southern rivers had become shaded, enriched tunnels.",
    source: "Nicholas Grubb, Salmon Watch Ireland, 13 May 2022",
    url: grubbUrl,
    published: "13 May 2022",
    limit: "This is his account, including figures from his own looking. It is not a national plant survey, and it is not a count of young salmon.",
  },
  {
    id: "race",
    stage: "stream",
    when: "then",
    kicker: "One place, his account",
    text: "He describes a tailrace at Castle Grace, on the Tar. Opened and widened in 1990, it grew crowfoot and a large number of trout. After willow and alder closed over it, he says the aquatic life went. He presents that length of water, about a kilometre, as proof of the process.",
    source: "Nicholas Grubb, Salmon Watch Ireland, 13 May 2022",
    url: grubbUrl,
    published: "13 May 2022",
    limit: "One man’s working of one mill-race. It cannot be read as Ireland.",
  },
  {
    id: "ifi-shade",
    stage: "stream",
    when: "latest",
    kicker: "Not in the stock reports",
    text: "The two national salmon-stock reports read here, January 2022 and December 2025, do not assess shade or crowfoot. They do say that freshwater habitat and water quality still limit production, and that getting more healthy young salmon to sea is the practical response while survival at sea is low.",
    source: "Technical Expert Group on Salmon, December 2025",
    url: tegos2025,
    published: "December 2025",
    limit: "Absence from these two reports is not proof that shade does nothing. It is a gap in the documents read.",
  },
  {
    id: "weir-nick",
    stage: "river",
    when: "then",
    kicker: "His own words, later in the same article",
    text: "Under the heading “Tear down the weirs”, Nicholas calls that approach futile. If a river has no lake near its head, he writes, the long slow water above a weir is where spring salmon can wait out the months. He remembers fish throwing themselves above the weir at Castle Grace. On that deep water, he says, trees to the bank are a good thing, for cooling shade. He names works at the Blackwater weirs of Clondulane, Careysville and Fermoy as a waste of money. He does not say what those works were.",
    source: "Nicholas Grubb, Salmon Watch Ireland, 13 May 2022",
    url: grubbUrl,
    published: "13 May 2022",
    limit: "His proposition, from the same article. Not a count of weirs, and not a record of when any one weir began to affect fish. The shade he wants here is the opposite of the shade he objects to in water less than a metre deep.",
  },
  {
    id: "weir-swi",
    stage: "river",
    when: "then",
    kicker: "The publisher’s framing",
    text: "Salmon Watch Ireland, introducing the article, said barriers should be improved so fish can move, and also that large deep sections of water may be appropriate on certain rivers. They agreed especially with his writing on the banks. They did not say they agreed with every line.",
    source: "Salmon Watch Ireland, 13 May 2022",
    url: grubbUrl,
    published: "13 May 2022",
    limit: "This is the publisher’s note, not a survey of weirs, and not a statement that BioVeracity or Salmon Watch Ireland are partners.",
  },
  {
    id: "weir-later",
    stage: "river",
    when: "latest",
    kicker: "Later stock report",
    text: "The December 2025 report says a barrier that fish cannot pass has the gravest effect, because it removes spawning water from the national stock. It also says easing a smaller barrier reduces the strain of migration. It does not call a weir simply good or simply bad.",
    source: "Technical Expert Group on Salmon, December 2025",
    url: tegos2025,
    published: "December 2025",
    limit: "No inventory of Irish weirs was read for this page. Which barrier, which river, and which part of the fish’s life are still open.",
  },
  {
    id: "green",
    stage: "estuary",
    when: "then",
    kicker: "Author’s proposition",
    text: "Looking down on the Blackwater tideway, he wrote that warmer weather and a heavier load of phosphate and nitrate were turning the water green, out into the bay. He points to constructed wetlands, of the kind Rory Harrington built at Dunhill, as a way to hold those nutrients.",
    source: "Nicholas Grubb, Salmon Watch Ireland, 13 May 2022",
    url: grubbUrl,
    published: "13 May 2022",
    limit: "A view from one house above one tideway. Not an Environmental Protection Agency table, and not a salmon count.",
  },
  {
    id: "epa",
    stage: "estuary",
    when: "latest",
    kicker: "National water assessment, cited later",
    text: "Inside the December 2025 salmon report, the Environmental Protection Agency’s 2019–2024 assessment is cited: 52% of surface waters at good ecological status or better, and 70% of estuarine waters in unsatisfactory condition. Nutrients, and habitat change including barriers and drainage, are named as the widespread issues.",
    source: "Technical Expert Group on Salmon, December 2025, citing EPA 2025",
    url: tegos2025,
    published: "December 2025. The water assessment covers 2019–2024.",
    limit: "Ireland, not the Blackwater tideway. A national water status is not his description of one bay, and neither figure is a count of salmon.",
  },
  {
    id: "sea-then",
    stage: "ocean",
    when: "then",
    kicker: "Known by January 2022",
    text: "The January 2022 stock report says marine survival of Irish salmon had fallen from 15 to 20 per cent of young fish returning as adults in the 1970s and 1980s, to a level fluctuating around 5 per cent. For the most recent years then in the series, just over 5 adults were described as returning for every 100 that left. The mechanisms, it says, were poorly understood.",
    source: "Gargan and others, Technical Expert Group on Salmon, January 2022",
    url: tegos2022,
    published: "January 2022, before the article.",
    limit: "A national description from tagged fish on index rivers. Not one bay, and not a cause assigned to a single farm or a single net.",
  },
  {
    id: "sea-later",
    stage: "ocean",
    when: "latest",
    kicker: "Latest description",
    text: "The December 2025 report describes survival as under 5 adults back for every 100 young fish that leave, among the lowest in the series, from coded-wire and PIT tagging by Inland Fisheries Ireland and the Marine Institute. It says return rates still differ between rivers. The exact reasons remain not fully understood.",
    source: "Technical Expert Group on Salmon, December 2025",
    url: tegos2025,
    published: "December 2025",
    limit: "“Around 5”, “just over 5” and “under 5” are the reports’ own rounded words for different years. They are not two points this page has plotted.",
  },
  {
    id: "farms",
    stage: "ocean",
    when: "then",
    kicker: "Author’s proposition",
    text: "He names three problems, and calls fish farming the most important: lice, local pollution, the loss of sea-trout fisheries, and the taking of small marine fish to feed the cages. He also writes of high-seas nets from the early 1960s and of nets off Ireland.",
    source: "Nicholas Grubb, Salmon Watch Ireland, 13 May 2022",
    url: grubbUrl,
    published: "13 May 2022",
    limit: "His weighing of which problem matters most. A tonnage he gives for marine feed was not checked against a catch series, so it is not repeated here as a measurement.",
  },
  {
    id: "pressure",
    stage: "ocean",
    when: "latest",
    kicker: "Later, one list among others",
    text: "The December 2025 report says the stressor scored highest for Ireland was climate change in the North Atlantic, which cannot readily be managed directly. The three priorities Ireland then names are pollution, habitat degradation, and aquaculture. Sea lice from salmon farming are listed as one coastal pressure that can reduce survival of wild smolts. They are not singled out as the cause.",
    source: "Technical Expert Group on Salmon, December 2025, citing NASCO 2025",
    url: tegos2025,
    published: "December 2025",
    limit: "A national stressor list. It does not score Nicholas right or wrong, and it does not locate a farm beside a named river on this page.",
  },
  {
    id: "home-then",
    stage: "return",
    when: "then",
    kicker: "Advice already published",
    text: "In January 2022, before his article, the advisers said that for the 2022 season 48 rivers had a harvestable surplus because they were above their conservation limit, 32 might open for catch-and-release only, and 64 were failing to reach half their limit or lacked the recent data to tell. A conservation limit is the number of returning adults a river is judged to need if the stock is to hold.",
    source: "Technical Expert Group on Salmon, January 2022",
    url: tegos2022,
    published: "January 2022",
    limit: "This is advice for a season, using that year’s rule. It is not the same test as a later percentage.",
  },
  {
    id: "home-later",
    stage: "return",
    when: "latest",
    kicker: "Latest national advice",
    text: "The December 2025 report says the International Council for the Exploration of the Sea estimates that wild salmon returning to Ireland fell from well over 1 million a year for much of the 1970s to under 200,000 in recent years. At a 75 per cent chance of meeting the limit, only 28 per cent of 144 designated river stocks were above it.",
    source: "Technical Expert Group on Salmon, December 2025, citing ICES",
    url: tegos2025,
    published: "December 2025",
    limit: "National. Not the Blackwater, not the Tar, and not a verdict on one man’s three causes.",
  },
  {
    id: "smolt",
    stage: "return",
    when: "then",
    kicker: "What he saw that spring",
    text: "From the rock above the Blackwater tideway, he writes that cormorants used to show him when the young salmon were leaving, and that in 2022 that activity was virtually none. He does not, in the passage read, tell the reader to kill the birds.",
    source: "Nicholas Grubb, Salmon Watch Ireland, 13 May 2022",
    url: grubbUrl,
    published: "13 May 2022. The watching is that spring.",
    limit: "One watcher’s reading of bird activity. Not a fish counter.",
  },
];

export const links: { from: string; to: string; status: string; note: string }[] = [
  {
    from: "Shade",
    to: "Crowfoot",
    status: "Hypothesis",
    note: "His proposition, and his tailrace. Not established for Ireland by the stock reports read here.",
  },
  {
    from: "Crowfoot",
    to: "Young fish",
    status: "Interpretation",
    note: "He says the plant holds the insects and the gravel. No national count of either was read.",
  },
  {
    from: "Life at sea",
    to: "Adults home",
    status: "Interpretation",
    note: "The January 2022 report says poorer survival at sea, rather than in the rivers, seems to explain the poor state of many populations. The mechanisms were poorly understood.",
  },
  {
    from: "Fish farming",
    to: "The decline",
    status: "Contested",
    note: "He calls it the most important cause. The later national list names aquaculture as one priority among pollution and habitat, under a climate stressor it cannot directly manage. No winner is picked.",
  },
  {
    from: "A barrier",
    to: "A river’s capacity",
    status: "Unresolved",
    note: "A barrier fish cannot pass is described, later, as the gravest loss of spawning water. A smaller barrier is a different question. No weir inventory was read.",
  },
];
