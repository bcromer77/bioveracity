// Pure helper deciding whether a JWT is still authoritative for a user. After a
// password reset we increment the user's authVersion; any JWT minted before that
// carries a lower version and must be rejected so old sessions genuinely lose
// access. A token for a user that no longer exists is never valid.

export function sessionAuthorityValid(input: {
  tokenAuthVersion: unknown
  currentAuthVersion: unknown
  userExists: boolean
}): boolean {
  if (!input.userExists) return false
  const tokenVersion = Number.isFinite(Number(input.tokenAuthVersion)) ? Number(input.tokenAuthVersion) : 0
  const currentVersion = Number.isFinite(Number(input.currentAuthVersion)) ? Number(input.currentAuthVersion) : 0
  return tokenVersion === currentVersion
}
