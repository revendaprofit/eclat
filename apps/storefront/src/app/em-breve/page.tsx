import { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "use.ÉCLAT — Em breve",
  description: "ÉCLAT. Em breve.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "use.ÉCLAT — Em breve",
    description: "ÉCLAT. Em breve.",
    images: [{ url: "/em-breve/camila-desktop.jpg" }],
  },
  robots: { index: true, follow: true },
}

export default function EmBrevePage() {
  return (
    <div className="min-h-screen bg-eclat-terracota-escuro overflow-x-hidden">
      <div className="min-h-screen flex flex-col small:grid small:grid-cols-[minmax(0,44%)_1fr]">
        {/* foto — mobile: topo, sangrando no painel */}
        <div className="small:hidden relative h-[52vh] min-h-[380px] w-full">
          <Image
            src="/em-breve/camila-mobile.jpg"
            alt="Camila, fundadora da use.ÉCLAT, sorrindo"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_18%]"
          />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-eclat-terracota-escuro to-transparent" />
        </div>

        {/* painel da marca */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-10 small:gap-12 px-6 py-14 small:py-0">
          <div className="anim-1">
            <Image
              src="/brand/logo-luz.png"
              alt="ÉCLAT"
              width={873}
              height={996}
              priority
              className="w-44 xsmall:w-52 small:w-[min(19vw,270px)] h-auto elo-breathe"
            />
          </div>
          <div className="anim-2 h-px w-14 bg-eclat-luz/40" />
          <p className="anim-3 uppercase tracking-[0.45em] indent-[0.45em] text-eclat-luz text-sm small:text-base">
            Em breve
          </p>
        </div>

        {/* foto — desktop: painel fixo à direita */}
        <div className="hidden small:block relative">
          <div className="sticky top-0 h-screen w-full overflow-hidden">
            <Image
              src="/em-breve/camila-desktop.jpg"
              alt="Camila, fundadora da use.ÉCLAT, sorrindo"
              fill
              priority
              sizes="56vw"
              className="object-cover object-[center_15%] kenburns"
            />
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-eclat-terracota-escuro to-transparent" />
          </div>
        </div>
      </div>
    </div>
  )
}
