// Central feature flags. Ask is gated OFF for the external Cambridgeshire demo
// release until the retrieval experience is rebuilt to the evidence-grade spec.
// Reads a NEXT_PUBLIC_ var so the same value is available on server and client.
export const ASK_ENABLED = process.env.NEXT_PUBLIC_ASK_ENABLED === 'true'
