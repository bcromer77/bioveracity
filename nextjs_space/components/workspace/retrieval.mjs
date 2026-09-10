/**
 * Client-side retrieval helpers for the private investigation workspace.
 *
 * The backend private-case search (lib/workspaces/case-files.ts) performs a
 * permissioned LITERAL substring match over a case's uploaded passages. That is
 * the only search service that is allowed to see private documents — private
 * content is never sent to an external AI or a parallel index.
 *
 * These helpers add term-expansion ON TOP of that existing endpoint so an
 * ordinary-language question retrieves relevant passages even when the source
 * uses different wording (e.g. "bats" -> "Pipistrelle", "Daubenton"; "flooding"
 * -> "inundation", "waterlogged"). We expand the query into a set of terms,
 * issue the existing substring search for each, then merge and rank the hits by
 * how many distinct query concepts each passage matched.
 *
 * This is keyword + term-expansion retrieval, NOT semantic search and NOT an AI
 * answer — callers must label it honestly. Pure (no React/DOM/fetch) so it is
 * unit-testable and shared by the client and tests.
 */

// Ordinary words that carry no retrieval signal. Superset of the public search
// stopwords (lib/search.ts) plus question phrasing.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'at', 'on', 'to', 'for', 'with', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had', 'do', 'does',
  'did', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'by', 'about', 'near', 'any',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'there', 'here',
  'me', 'my', 'we', 'our', 'you', 'your', 'they', 'their', 'show', 'tell', 'find', 'list',
  'give', 'get', 'please', 'can', 'could', 'would', 'should', 'will', 'shall', 'may',
  'does', 'not', 'no', 'yes', 'all', 'some', 'more', 'most', 'was', 'per', 'into', 'out',
]);

// Domain synonym / concept groups. Any token belonging to a group expands to the
// whole group so wording differences in the source still match. Members may be
// multi-word phrases (the backend does substring matching, so phrases are fine).
export const CONCEPT_GROUPS = [
  ['bat', 'bats', 'pipistrelle', 'daubenton', "daubenton's", 'daubentons', 'myotis', 'chiroptera', 'roost', 'roosting', 'roosts'],
  ['flood', 'floods', 'flooding', 'flooded', 'floodplain', 'floodplains', 'inundation', 'inundated', 'waterlogged', 'waterlogging', 'fluvial', 'pluvial', 'overtopping'],
  ['otter', 'otters', 'lutra'],
  ['badger', 'badgers', 'sett', 'setts', 'meles'],
  ['kingfisher', 'alcedo'],
  ['survey', 'surveys', 'surveyed', 'appraisal', 'assessment', 'walkover', 'transect', 'scoping'],
  ['protected', 'annex', 'natura', 'designated', 'sac', 'spa', 'nha', 'pnha'],
  ['absence', 'absent', 'negative', 'none recorded', 'not recorded', 'not observed', 'no evidence'],
  ['river', 'rivers', 'watercourse', 'watercourses', 'stream', 'streams', 'waterbody', 'waterbodies'],
  ['water quality', 'wfd', 'water framework', 'ecological status', 'epa'],
  ['habitat', 'habitats', 'hedgerow', 'hedgerows', 'woodland', 'grassland', 'wetland'],
  ['permission', 'permit', 'consent', 'planning', 'application'],
  ['objection', 'objections', 'submission', 'observation', 'appeal'],
];

// word -> array of group members (built once).
const EXPANSION = (() => {
  const map = new Map();
  for (const group of CONCEPT_GROUPS) {
    for (const word of group) {
      const key = word.toLowerCase();
      const existing = map.get(key) || [];
      for (const member of group) if (!existing.includes(member)) existing.push(member);
      map.set(key, existing);
    }
  }
  return map;
})();

/** Keep a token if it is meaningful: >=3 letters, or contains a digit (permit refs, dates). */
function keepToken(token) {
  if (!token) return false;
  if (STOPWORDS.has(token)) return false;
  if (/\d/.test(token)) return true;
  return token.length >= 3;
}

/**
 * Expand a free-text query into a de-duplicated set of search strings.
 * Returns { phrase, tokens, terms } where:
 *   phrase  - the trimmed original query (exact-phrase pass, ranked highest)
 *   tokens  - the meaningful tokens from the query (the "concepts asked for")
 *   terms   - every distinct string to search (phrase + tokens + synonyms)
 */
export function expandQuery(query) {
  const phrase = String(query ?? '').trim();
  const lower = phrase.toLowerCase();
  const rawTokens = lower.split(/[^a-z0-9']+/i).filter(Boolean);
  const tokens = [];
  for (const t of rawTokens) if (keepToken(t) && !tokens.includes(t)) tokens.push(t);

  const terms = [];
  const add = (s) => { const v = String(s || '').trim(); if (v && !terms.some(x => x.toLowerCase() === v.toLowerCase())) terms.push(v); };
  if (phrase) add(phrase);
  for (const token of tokens) {
    add(token);
    const expanded = EXPANSION.get(token);
    if (expanded) for (const member of expanded) add(member);
  }
  // Bound the number of backend calls.
  return { phrase, tokens, terms: terms.slice(0, 24) };
}

/**
 * Merge per-term hit lists into a single ranked list.
 * @param perTerm Array<{ term: string, hits: Array<{id,...}> }>
 * @param tokens  the meaningful query tokens (concepts), for coverage reporting
 * Returns { ranked, matchedConcepts, unmatchedConcepts } where ranked hits carry
 * matchedTerms (the distinct query strings that hit that passage) and a score.
 */
export function rankResults(perTerm, tokens = []) {
  const byId = new Map();
  for (const { term, hits } of perTerm) {
    for (const hit of hits || []) {
      if (!hit || !hit.id) continue;
      const entry = byId.get(hit.id) || { hit, matched: new Set() };
      entry.matched.add(term);
      byId.set(hit.id, entry);
    }
  }
  const ranked = Array.from(byId.values()).map(({ hit, matched }) => ({
    ...hit,
    matchedTerms: Array.from(matched),
    score: matched.size,
  }));
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const an = `${a.name || ''}${a.locator || ''}`;
    const bn = `${b.name || ''}${b.locator || ''}`;
    return an < bn ? -1 : an > bn ? 1 : 0;
  });

  // Which of the concepts the user actually asked about were found at all?
  const foundTerms = new Set();
  for (const { term, hits } of perTerm) if ((hits || []).length) foundTerms.add(term.toLowerCase());
  const conceptList = tokens.length ? tokens : [];
  const matchedConcepts = [];
  const unmatchedConcepts = [];
  for (const concept of conceptList) {
    const members = (EXPANSION.get(concept) || [concept]).map(s => s.toLowerCase());
    const hitAny = members.some(m => foundTerms.has(m)) || foundTerms.has(concept.toLowerCase());
    (hitAny ? matchedConcepts : unmatchedConcepts).push(concept);
  }
  return { ranked, matchedConcepts, unmatchedConcepts };
}
