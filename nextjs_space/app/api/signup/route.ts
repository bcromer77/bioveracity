export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json()
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: 'user' },
    })
    return NextResponse.json({ id: user.id, email: user.email, name: user.name })
  } catch (error: any) {
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
