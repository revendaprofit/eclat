import { Metadata } from "next"
import Image from "next/image"
import { getBaseURL } from "@lib/util/env"
import WaitlistForm from "./waitlist-form"

export const metadata: Metadata = {
  title: "use.ÉCLAT — Em breve",
  description:
    "A primeira coleção da use.ÉCLAT já está pronta. Entre na lista e seja a primeira a saber quando abrirmos.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "use.ÉCLAT — Em breve",
    description:
      "A primeira coleção da use.ÉCLAT já está pronta. Entre na lista e seja a primeira a saber quando abrirmos.",
    images: [{ url: "/em-breve/camila-desktop.jpg" }],
  },
  robots: { index: true, follow: true },
}

const PROVAS = [
  {
    titulo: "Coleção fechada",
    texto:
      "Tops, shorts, leggings e macaquinhos em Verde Exército, Licor e Blackout — prontos.",
  },
  {
    titulo: "Tecido que não trai",
    texto: "Encorpado e opaco: não abre a trama no agachamento.",
  },
  {
    titulo: "Cós que fica no lugar",
    texto: "Alto e firme, sem descer nem enrolar no treino.",
  },
]

export default function EmBrevePage() {
  return (
    <div className="min-h-screen bg-eclat-terracota-escuro overflow-x-hidden">
      <div className="small:grid small:grid-cols-[minmax(0,42%)_1fr]">
        {/* foto — mobile: topo, sangrando no painel */}
        <div className="small:hidden relative h-[46vh] min-h-[340px] w-full">
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

        {/* coluna de conteúdo */}
        <div className="relative z-10 flex flex-col justify-center px-6 py-14 xsmall:px-10 small:px-14 small:py-16 large:px-20">
          <div className="max-w-md mx-auto small:mx-0 w-full">
            {/* marca */}
            <div className="anim-1 flex flex-col items-start gap-4">
              <Image
                src="/em-breve/elo-branco.png"
                alt=""
                width={494}
                height={660}
                priority
                className="h-12 w-auto elo-breathe"
              />
              <span className="font-serif text-2xl tracking-[0.08em] text-eclat-luz">
                ÉCLAT
              </span>
            </div>

            <div className="anim-2 mt-6 h-px w-12 bg-eclat-luz/40 origin-left" />

            <p className="anim-3 mt-6 uppercase tracking-[0.22em] text-xs text-eclat-blush">
              Em breve · primeira coleção
            </p>

            <h1 className="anim-4 mt-4 font-serif text-4xl xsmall:text-5xl small:text-[3.25rem] leading-[1.08] text-eclat-luz text-balance">
              Agache sem pensar
              <br className="hidden xsmall:block" /> duas vezes.
            </h1>

            <p className="anim-5 mt-5 text-eclat-luz/80 leading-relaxed">
              A primeira coleção já está pronta — tops, shorts, leggings e
              macaquinhos em Verde Exército, Licor e Blackout. Tecido opaco
              de verdade, cós que não desce.
            </p>

            {/* convite da lista */}
            <div className="anim-6 mt-10">
              <h2 className="font-serif text-xl text-eclat-luz mb-4">
                Entre antes da vitrine
              </h2>
              <ul className="space-y-2.5 mb-6">
                {[
                  "Acesso antes do público, quando o site ainda estiver fechado.",
                  "Condição de fundadora só na primeira compra.",
                  "Escolha sua cor e tamanho favoritos antes de esgotar.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-eclat-luz/80 leading-relaxed"
                  >
                    <span
                      className="mt-2 h-1 w-1 rounded-full bg-eclat-blush shrink-0"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <WaitlistForm />
            </div>

            {/* bilhete da fundadora */}
            <div className="anim-7 mt-12 pt-8 border-t border-eclat-luz/15">
              <p className="font-serif italic text-eclat-luz/90 leading-relaxed text-[0.95rem]">
                &ldquo;Eu cansei de treinar puxando a legging para cima e de
                checar no espelho se estava transparente. Fui atrás de um
                tecido que aguentasse o agachamento e continuasse bonito na
                rua — até achar o certo. A ÉCLAT nasceu dessa teimosia. Que
                bom que você chegou aqui antes de todo mundo.&rdquo;
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-eclat-luz/55">
                Camila · fundadora da ÉCLAT
              </p>
            </div>

            {/* provas */}
            <dl className="anim-8 mt-12 grid grid-cols-1 xsmall:grid-cols-3 gap-6 xsmall:gap-4">
              {PROVAS.map((p) => (
                <div key={p.titulo} className="pt-3 border-t border-eclat-luz/20">
                  <dt className="font-serif text-sm text-eclat-luz mb-1">
                    {p.titulo}
                  </dt>
                  <dd className="text-xs text-eclat-luz/60 leading-relaxed">
                    {p.texto}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="anim-8 mt-12 text-xs tracking-[0.2em] uppercase text-eclat-luz/40">
              Athleisure da mulher inteira
            </p>
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
              sizes="58vw"
              className="object-cover kenburns"
            />
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-eclat-terracota-escuro to-transparent" />
          </div>
        </div>
      </div>
    </div>
  )
}
