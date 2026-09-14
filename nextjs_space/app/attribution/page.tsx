import Link from 'next/link'
export const metadata = { title: 'Map and source attribution | BioVeracity' }
export default function AttributionPage() {
 return <main className="mx-auto max-w-3xl space-y-5 p-8">
  <Link href="/">BioVeracity</Link><h1 className="text-3xl font-semibold">Map and source attribution</h1>
  <p>Maps retain the credits supplied by their tile layers. Depending on the layer, these include Esri, Maxar, Earthstar Geographics and the GIS User Community. Map interfaces use Leaflet.</p>
  <p>Esri reference: <span className="select-all">https://www.esri.com/</span></p>
  <p>Leaflet reference: <span className="select-all">https://leafletjs.com/</span></p>
  <p>Environmental records show their own publisher, record identifier, available dates and licence. An API response is a source record, not independent confirmation of its claims. Original reference URIs are retained as text inside BioVeracity.</p>
 </main>
}
