import { getWildVenue } from '../wild-counties/venues'
import { enabled, hubDb } from './http'
import { publicHub } from './service'
export async function getPublishedHub(id: string) {
  if (
    !enabled() ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    return null
  return publicHub(hubDb, id)
}
export async function hasPublicVenue(id: string) {
  return Boolean(getWildVenue(id) || (await getPublishedHub(id)))
}
