// Synthetic reproduction of the legacy published WildHub snapshot shape that crashed
// production hub rendering (plan: null). Keys, types and array lengths mirror the live
// record; every value is fictional.
export const nullPlanSnapshot = {
  approvedAt: '2026-09-17T15:36:05.025Z',
  photoIds: ['fixture-photo-1', 'fixture-photo-2'],
  plan: null,
  profile: {
    county: 'down',
    interests: ['nature'],
    invitation: 'A fictional invitation to notice the season.',
    kind: 'hotel',
    locality: 'Fictional locality',
    name: 'Null Plan Fixture Hotel',
    natureStory: 'A fictional nature story.',
    photoIds: ['fixture-photo-1', 'fixture-photo-2'],
    recommendations: ['A fictional recommendation.'],
    story: 'A fictional legacy venue story.',
    visitPrompt: 'A fictional visit prompt.',
    visitUrl: 'https://example.test/visit',
    website: 'https://example.test',
  },
  reviewedAt: '2026-09-17T15:36:05.025Z',
  version: 8,
}
