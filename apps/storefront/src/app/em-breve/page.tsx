import { Metadata } from "next"
import Image from "next/image"
import WaitlistForm from "./waitlist-form"

// WhatsApp da marca (o mesmo conectado ao Cockpit). A mensagem pré-preenchida é o
// gatilho da resposta automática que entrega o link do grupo do Clube Éclat.
const CLUBE_WHATSAPP_URL =
  "https://wa.me/5531991184431?text=" +
  encodeURIComponent("Quero entrar no Clube Éclat ✨")

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

          {/* Clube Éclat: entrada pelo WhatsApp da marca (vira lead no Cockpit) + e-mail como plano B */}
          <div className="anim-3 w-full max-w-md flex flex-col items-center gap-5 text-center">
            <p className="text-eclat-luz/80 text-sm small:text-base leading-relaxed">
              O lote de estreia abre <strong className="text-eclat-luz font-semibold">24 horas antes</strong>{" "}
              para quem está no <strong className="text-eclat-luz font-semibold">Clube Éclat</strong>.
              Poucas peças, quem chega primeiro leva.
            </p>
            <a
              href={CLUBE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-eclat-luz text-eclat-terracota-escuro uppercase tracking-widest text-xs font-semibold px-8 py-4 hover:bg-white transition-colors"
            >
              Entrar no Clube Éclat pelo WhatsApp
            </a>
            <details className="w-full text-left">
              <summary className="cursor-pointer text-xs text-eclat-luz/55 text-center list-none hover:text-eclat-luz/80">
                Prefere e-mail? Deixe o seu aqui
              </summary>
              <div className="mt-4">
                <WaitlistForm />
              </div>
            </details>
          </div>
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
