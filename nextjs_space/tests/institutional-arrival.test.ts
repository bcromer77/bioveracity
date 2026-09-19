import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { institutionalInviteService, invitationAcceptanceService, hashInvitationToken, normaliseEmail, passwordInput } from '../lib/workspaces/invitations'
import { workspaceService, WorkspaceError, type Database, type Sql } from '../lib/workspaces/service'

test('account inputs are normalised and validated server-side', () => {
  assert.equal(normaliseEmail('  Officer@Cambridge.GOV.UK '), 'officer@cambridge.gov.uk')
  assert.throws(() => normaliseEmail('not-an-email'), WorkspaceError)
  assert.equal(passwordInput('long-enough-password'), 'long-enough-password')
  assert.throws(() => passwordInput('short'), WorkspaceError)
  assert.equal(hashInvitationToken('abc'), hashInvitationToken('abc'))
  assert.notEqual(hashInvitationToken('abc'), 'abc')
})

test('institutional invitation provisions only the invited user and is single-use', async () => {
  const pg = new PGlite()
  try {
    await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL); INSERT INTO "User" VALUES (\'owner\',\'owner@example.com\'),(\'officer\',\'officer@cambridge.gov.uk\'),(\'other\',\'other@example.com\');')
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260909_private_workspace_foundation/migration.sql', import.meta.url), 'utf8'))
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260911_workspace_persona/migration.sql', import.meta.url), 'utf8'))
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260919_institutional_arrival/migration.sql', import.meta.url), 'utf8'))

    const sql = (client: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows })
    const db: Database = { ...sql(pg), transaction: operation => pg.transaction(tx => operation(sql(tx))) }

    const owner = workspaceService(db, 'owner')
    const workspace = await owner.createWorkspace({ name: 'Cambridgeshire BNG Evidence', persona: 'ecology' })
    const caseRecord = await owner.createCase(workspace.id, { title: 'Waterbeach', template: 'PLANNING' })

    const created = await institutionalInviteService(db, 'owner').create({
      workspaceId: workspace.id,
      caseId: caseRecord.id,
      email: ' Officer@Cambridge.GOV.UK ',
      role: 'REVIEWER',
      canExport: true,
    })

    const rawStored = await pg.query<{ tokenHash: string; email: string }>('SELECT "tokenHash",email FROM "PrivateWorkspaceInvitation" WHERE id=$1', [created.id])
    assert.equal(rawStored.rows[0].email, 'officer@cambridge.gov.uk')
    assert.notEqual(rawStored.rows[0].tokenHash, created.token)

    await assert.rejects(
      invitationAcceptanceService(db, 'other', 'other@example.com').accept(created.token),
      (e: unknown) => e instanceof WorkspaceError && e.status === 403,
    )

    const accepted = await invitationAcceptanceService(db, 'officer', 'OFFICER@CAMBRIDGE.GOV.UK').accept(created.token)
    assert.equal(accepted.destination, `/workspace/${workspace.id}?case=${caseRecord.id}`)

    const member = await pg.query<{ role: string; canExport: boolean }>(
      'SELECT c.role,c."canExport" FROM "PrivateCaseMember" c WHERE c."workspaceId"=$1 AND c."caseId"=$2 AND c."userId"=$3',
      [workspace.id, caseRecord.id, 'officer'],
    )
    assert.deepEqual(member.rows[0], { role: 'REVIEWER', canExport: true })

    await assert.rejects(
      invitationAcceptanceService(db, 'officer', 'officer@cambridge.gov.uk').accept(created.token),
      (e: unknown) => e instanceof WorkspaceError && e.status === 410,
    )
  } finally {
    await pg.close()
  }
})

test('revoked invitation cannot be accepted', async () => {
  const pg = new PGlite()
  try {
    await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL); INSERT INTO "User" VALUES (\'owner\',\'owner@example.com\'),(\'invitee\',\'invitee@example.com\');')
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260909_private_workspace_foundation/migration.sql', import.meta.url), 'utf8'))
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260911_workspace_persona/migration.sql', import.meta.url), 'utf8'))
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260919_institutional_arrival/migration.sql', import.meta.url), 'utf8'))
    const sql = (client: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows })
    const db: Database = { ...sql(pg), transaction: operation => pg.transaction(tx => operation(sql(tx))) }

    const ws = await workspaceService(db, 'owner').createWorkspace({ name: 'Niamh evidence', persona: 'planning' })
    const invite = await institutionalInviteService(db, 'owner').create({ workspaceId: ws.id, email: 'invitee@example.com', role: 'VIEWER' })
    await institutionalInviteService(db, 'owner').revoke(ws.id, invite.id)

    await assert.rejects(
      invitationAcceptanceService(db, 'invitee', 'invitee@example.com').accept(invite.token),
      (e: unknown) => e instanceof WorkspaceError && e.status === 410,
    )
  } finally {
    await pg.close()
  }
})
