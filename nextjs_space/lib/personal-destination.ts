// Inputs must already be filtered by server-side account permissions.
// Mixed/empty accounts get a personal home; one-purpose accounts resume that purpose.
export function personalDestination(workspaces: readonly {id:string}[], venueCount:number, cases:readonly {id:string}[]=[]):string|null {
 if (!workspaces.length && venueCount>0) return '/wild/studio'
 if (workspaces.length===1 && venueCount===0) return `/workspace/${encodeURIComponent(workspaces[0].id)}${cases.length===1?`?case=${encodeURIComponent(cases[0].id)}`:''}`
 return null
}
