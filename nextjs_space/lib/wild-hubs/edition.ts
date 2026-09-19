// Shared edition mapper. A single place that turns a saved profile + plan + photos
// into the view a Wild Counties visitor sees. Preview, published and editorial-review
// pages all build their view from here so the three can never drift apart.
import {
  activeCampaign,
  MONTHS,
  type Plan,
  type Profile,
  type Recommendation,
} from './domain'

export type EditionPhoto = { id: string; caption: string; credit: string; src: string }
export type EditionCampaign = {
  month: number
  monthName: string
  title: string
  introduction: string
  activity: string
}
export type EditionKind = 'preview' | 'published' | 'review'
export type EditionView = {
  kind: EditionKind
  county: string
  countyBrand: string
  placeName: string
  locality: string
  invitation: string
  story: string
  natureStory: string
  website: string
  visitUrl: string
  visitPrompt: string
  interests: string[]
  photos: EditionPhoto[]
  campaign: EditionCampaign | null
  recommendations: Recommendation[]
  provenanceLabel: string
  reviewedLabel: string | null
}

export function buildEdition({
  kind,
  profile,
  plan,
  photos,
  countyBrand,
  provenanceLabel,
  reviewedLabel = null,
  now,
}: {
  kind: EditionKind
  profile: Profile
  plan: Plan | null
  photos: EditionPhoto[]
  countyBrand: string
  provenanceLabel: string
  reviewedLabel?: string | null
  now?: Date
}): EditionView {
  const active = plan ? activeCampaign(plan, now ?? new Date()) : null
  const campaign: EditionCampaign | null = active
    ? {
        month: active.month,
        monthName: MONTHS[active.month - 1],
        title: active.title,
        introduction: active.introduction,
        activity: active.activity,
      }
    : null
  return {
    kind,
    county: profile.county,
    countyBrand,
    placeName: profile.name,
    locality: profile.locality || '',
    invitation: profile.invitation || '',
    story: profile.story || '',
    natureStory: profile.natureStory || '',
    website: profile.website || '',
    visitUrl: profile.visitUrl || '',
    visitPrompt: profile.visitPrompt || '',
    interests: profile.interests || [],
    photos,
    campaign,
    recommendations: profile.recommendations || [],
    provenanceLabel,
    reviewedLabel,
  }
}
