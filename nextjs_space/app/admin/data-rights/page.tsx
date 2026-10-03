import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/access'
import { redirect, notFound } from 'next/navigation'
import { RightsAdmin } from '@/components/account/rights-admin'
export const dynamic='force-dynamic'
export default async function Page(){
 const s=await auth();if(!s?.user?.id)redirect('/login?callbackUrl=/admin/data-rights')
 const u=await prisma.user.findUnique({where:{id:s.user.id},select:{id:true,role:true,accessState:true}})
 if(!u||!isAdmin({user:u,expires:''}))notFound()
 return <main className="mx-auto max-w-4xl px-5 py-10"><RightsAdmin/></main>
}
