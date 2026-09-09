import { body, privateRequest } from '@/lib/workspaces/http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() { return privateRequest(async s => ({ workspaces: await s.listWorkspaces() })) }
export async function POST(request: Request) { return privateRequest(async s => ({ workspace: await s.createWorkspace(await body(request)) }), 201) }
