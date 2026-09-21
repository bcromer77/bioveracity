'use client'
import {useEffect,useState} from 'react'
export function VenuePhotoWithdraw(){
 const [id,setId]=useState(''),[token,setToken]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false)
 useEffect(()=>{setId(new URLSearchParams(window.location.search).get('id')||'');setToken(window.location.hash.slice(1))},[])
 async function withdraw(){setBusy(true);try{const r=await fetch(`/api/wild/journal/photos/${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const j=await r.json();if(!r.ok)throw Error(j.error);setDone(true);setMessage('Photograph withdrawn. Its stored image and public display have been removed.')}catch(e){setMessage(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}}
 return <section className="bv-section"><h1>Your photo receipt</h1><p>Bookmark this page to keep your private withdrawal link. Anyone with this complete link can withdraw your photograph.</p><p>Withdrawal removes the stored image and public display. Previously downloaded or emailed copies cannot be recalled.</p><button className="bv-button" disabled={!id||!token||busy||done} onClick={()=>{if(window.confirm('Withdraw this photograph and remove its stored image?'))withdraw()}}>Withdraw my photograph</button>{message&&<p role="status">{message}</p>}</section>
}
