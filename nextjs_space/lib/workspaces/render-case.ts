import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { EventRow } from './case-files'
export async function renderCase(manifest: Record<string, unknown>): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.setTitle('BioVeracity reviewed case timeline');pdf.setProducer('BioVeracity case-renderer/1')
  pdf.setCreationDate(new Date(String(manifest.createdAt)));pdf.setModificationDate(new Date(String(manifest.createdAt)))
  let page=pdf.addPage([595,842]), y=795
  // Preserve unsupported characters explicitly, not silently as replacement glyphs.
  const safe=(s:string)=>Array.from(s).map(ch=>{try{font.encodeText(ch);return ch}catch{return `[U+${ch.codePointAt(0)!.toString(16).toUpperCase()}]`}}).join('')
  function line(text:string,size=10) {
    const parts:string[]=[];let current=''
    for(const ch of safe(text).replace(/[\r\n\t]/g,' ')) {
      if(current&&font.widthOfTextAtSize(current+ch,size)>511){parts.push(current);current=''}
      current+=ch
    }
    parts.push(current)
    for(const part of parts){if(y<60){if(pdf.getPageCount()>=150)throw new Error('PDF page limit exceeded');page=pdf.addPage([595,842]);y=795}page.drawText(part.trim(),{x:42,y,size,font,color:rgb(.12,.16,.2)});y-=size+5}
  }
  line(String((manifest.case as {title:string}).title),16);line(`Issued ${manifest.createdAt}`);line(`Export ${manifest.exportId}`);line(String(manifest.notice));line('Unicode outside the PDF core font is shown as [U+codepoint]; the JSON manifest retains original Unicode.');y-=12
  for(const e of manifest.events as EventRow[]){line(`${e.eventDate??'Date unknown'} (${e.precision}) — ${e.title}`,12);line(`${e.evidenceType} | revision ${e.revision} | reviewed by ${e.reviewedBy}`);if(e.superseded)line('SOURCE HAS BEEN SUPERSEDED: this entry is retained as historical evidence.');line(`Source: ${e.name} | ${e.locator}`);line(`Document ${e.documentId} | SHA-256 ${e.hash}`);if(e.sourceUrl)line(`Source URL (user supplied): ${e.sourceUrl}`);line(`Publication: ${e.publicationDate??'unknown'} | Imported: ${e.importedAt}`);line(`Quote: ${e.quote}`);if(e.note)line(`Review note: ${e.note}`);y-=14}
  const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText(`BioVeracity | ${i+1}/${pages.length}`,{x:42,y:28,size:9,font}))
  return Buffer.from(await pdf.save())
}
