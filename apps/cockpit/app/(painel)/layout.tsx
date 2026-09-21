import { redirect } from "next/navigation"
import { createSupabaseServer } from "@/lib/supabase/server"
import Sidebar from "@/components/sidebar"

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    // `lg:flex` porque no celular o menu é gaveta sobreposta, não coluna. `max-w-7xl` em vez de
    // 6xl: as tabelas do painel têm 6+ colunas e viviam espremidas com o monitor sobrando.
    <div className="lg:flex min-h-screen">
      <Sidebar email={user.email} />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 max-w-7xl">{children}</main>
    </div>
  )
}
