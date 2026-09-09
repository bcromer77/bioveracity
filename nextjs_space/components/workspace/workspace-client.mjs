/** Browser-only API boundary. Never cache case contents in localStorage. */
export const templates = [
  { id: 'PLANNING', label: 'Planning case', question: 'What happened at each site, and which source supports it?' },
  { id: 'FARMER', label: 'Farm decision', question: 'Which records do I need to discuss funding, costs and constraints with my adviser?' },
  { id: 'ESG', label: 'ESG evidence', question: 'Which documents support a commitment, and what is still missing?' },
  { id: 'FREIGHT', label: 'Freight / trade evidence', question: 'Which shipment and supplier records are needed for the importer’s review?' },
  { id: 'GENERAL', label: 'Other decision', question: 'What must I establish before making this decision?' },
];

export function casePayload(title, template, siteText) {
  const cleanTitle = title.trim();
  const names = siteText.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
  if (!cleanTitle || cleanTitle.length > 160) throw new Error('Enter a case title of 1–160 characters.');
  if (!templates.some(item => item.id === template)) throw new Error('Choose a supported case template.');
  if (names.length > 20 || names.some(name => name.length > 160)) throw new Error('Use up to 20 sites, with a name of at most 160 characters for each.');
  return { title: cleanTitle, template, sites: names.map(name => ({ name })) };
}

export function apiMessage(status) {
  if (status === 401) return 'Your session has ended. Sign in again to continue.';
  if (status === 403 || status === 404) return 'This workspace or case is unavailable to your account.';
  if (status === 503) return 'Private workspaces are not enabled on this installation yet. Nothing has been saved by this request.';
  if (status === 400) return 'The request could not be accepted. Check the field lengths and try again.';
  if (status === 429) return 'Too many requests. Wait a moment before trying again.';
  return 'The request could not be completed. Refresh to check whether it was saved before submitting again.';
}

export async function workspaceRequest(path, options = {}, fetcher = fetch) {
  const response = await fetcher(path, {
    ...options, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) throw new Error(apiMessage(response.status));
  return response.json();
}

export function caseListPath(workspaceId) {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/cases`;
}

export function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';
}
