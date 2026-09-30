import { listRegions } from "@lib/data/regions";
import { getNavigation } from "@lib/data/navigation";
import { StoreRegion } from "@medusajs/types";
import Image from "next/image";

import LocalizedClientLink from "@modules/common/components/localized-client-link";
import IdentificacaoDaEmpresa from "@modules/layout/components/identificacao-da-empresa";
import { getPrevenda, linkClubeWhatsapp } from "@lib/data/prevenda";
import { getSiteContent } from "@lib/data/site-content";
import { linkPerfilInstagram } from "@lib/util/instagram";
import { EMPRESA, enderecoEmUmaLinha } from "@lib/empresa";
import { HOME_DEFAULTS, Instagram } from "@modules/home/content";

type Link = { label: string; href: string; externo?: boolean };

// 5531991184431 → (31) 99118-4431
function telefoneLegivel(numero: string): string {
  const d = numero.replace(/\D/g, "").replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : numero;
}

function ItemLink({ link }: { link: Link }) {
  const cls = "hover:text-eclat-luz transition-colors";
  return link.externo ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {link.label}
    </a>
  ) : (
    <LocalizedClientLink href={link.href} className={cls}>
      {link.label}
    </LocalizedClientLink>
  );
}

// Uma coluna no computador; no celular vira sanfona (<details>, sem JS), como na referência beatco.com.br.
function Grupo({ titulo, links }: { titulo: string; links: Link[] }) {
  const lista = (
    <ul className="flex flex-col gap-3 text-sm text-eclat-luz/70">
      {links.map((l) => (
        <li key={l.href + l.label}>
          <ItemLink link={l} />
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <details className="small:hidden group border-b border-eclat-luz/15">
        <summary className="flex items-center justify-between py-5 cursor-pointer list-none uppercase tracking-widest text-sm text-eclat-luz">
          {titulo}
          <span aria-hidden className="text-xl leading-none transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="pb-5">{lista}</div>
      </details>
      <div className="hidden small:flex flex-col gap-4">
        <span className="uppercase tracking-widest text-xs text-eclat-luz">{titulo}</span>
        {lista}
      </div>
    </>
  );
}

const Icone = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-current`}>
    <path d={d} />
  </svg>
);
const ICONE_WHATSAPP =
  "M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.5a.6.6 0 0 0 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.7A11.8 11.8 0 1 0 12 .2Z";
const ICONE_EMAIL = "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L4 7.4V17h16V7.4l-8 4.8ZM19.2 7H4.8L12 11.3 19.2 7Z";
const ICONE_LOCAL = "M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7Zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5Z";
const ICONE_INSTAGRAM =
  "M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2Zm0 4.9a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8Zm0 8.1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.1-9.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z";

const FORMAS_DE_PAGAMENTO = ["Pix", "Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

export default async function Footer() {
  // I8: mesma árvore de navegação da barra/menu (getNavigation) — só raízes visíveis
  // (≥1 produto publicado), na ordem de rank. As coleções vêm da mesma fonte (só as que
  // têm produto publicado): coleção cadastrada mas não lançada não aparece no rodapé.
  const regions = await listRegions()
    .then((r: StoreRegion[]) => r)
    .catch(() => [] as StoreRegion[]);
  const countryCode = regions?.[0]?.countries?.[0]?.iso_2 ?? "br";
  const [{ roots, collections }, prevenda, instagram] = await Promise.all([
    getNavigation(countryCode),
    getPrevenda(),
    getSiteContent<Instagram>("home.instagram"),
  ]);
  const linkClube = linkClubeWhatsapp(prevenda);
  const linkInstagram = linkPerfilInstagram(instagram?.handle || HOME_DEFAULTS.instagram.handle);
  const linkWhatsapp = `https://wa.me/${prevenda.whatsapp}`;

  const loja: Link[] = [
    { label: "Toda a loja", href: "/store" },
    ...roots.map((r) => ({ label: r.name, href: `/categories/${r.handle}` })),
    ...(collections || []).slice(0, 4).map((c) => ({ label: `Coleção ${c.title}`, href: `/collections/${c.handle}` })),
  ];
  const institucional: Link[] = [
    { label: "Sobre a Éclat", href: "/sobre" },
    { label: "Editorial", href: "/editorial" },
    { label: "Clube Éclat", href: linkClube, externo: true },
    { label: "Minha conta", href: "/account" },
  ];
  const politicas: Link[] = [
    { label: "Trocas e devoluções", href: "/trocas-e-devolucoes" },
    { label: "Guia de medidas", href: "/guia-de-medidas" },
    { label: "Privacidade", href: "/privacidade" },
  ];

  return (
    <footer className="w-full bg-eclat-grafite text-eclat-luz">
      <div className="content-container py-14 small:py-20">
        <div className="grid grid-cols-1 small:grid-cols-[1.3fr_1fr_1fr_1fr] gap-0 small:gap-12">
          {/* marca + contato */}
          <div className="flex flex-col gap-6 pb-10 small:pb-0">
            <LocalizedClientLink href="/" className="flex items-center gap-2" aria-label="use.ÉCLAT — início">
              {/* invert: logo escura sobre o fundo grafite */}
              <Image src="/brand/mark.png" alt="" width={27} height={36} className="h-9 w-auto brightness-0 invert" />
              <Image src="/brand/wordmark.png" alt="use.ÉCLAT" width={75} height={24} className="h-[22px] w-auto brightness-0 invert" />
            </LocalizedClientLink>
            <div className="flex flex-col gap-4">
              <span className="uppercase tracking-widest text-xs">Contato</span>
              <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-eclat-luz/80 hover:text-eclat-luz">
                <Icone d={ICONE_WHATSAPP} />
                <span className="underline underline-offset-4">{telefoneLegivel(prevenda.whatsapp)}</span>
              </a>
              <a href={`mailto:${EMPRESA.email}`} className="flex items-center gap-3 text-sm text-eclat-luz/80 hover:text-eclat-luz">
                <Icone d={ICONE_EMAIL} />
                <span className="underline underline-offset-4 break-all">{EMPRESA.email}</span>
              </a>
              <p className="flex items-start gap-3 text-sm text-eclat-luz/80">
                <Icone d={ICONE_LOCAL} />
                <span>{enderecoEmUmaLinha()}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              {linkInstagram && (
                <a href={linkInstagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram da use.ÉCLAT" className="text-eclat-luz/80 hover:text-eclat-terracota">
                  <Icone d={ICONE_INSTAGRAM} className="h-6 w-6" />
                </a>
              )}
              <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp da use.ÉCLAT" className="text-eclat-luz/80 hover:text-eclat-terracota">
                <Icone d={ICONE_WHATSAPP} className="h-6 w-6" />
              </a>
            </div>
          </div>

          <div className="border-t border-eclat-luz/15 small:border-0">
            <Grupo titulo="Loja" links={loja} />
          </div>
          <Grupo titulo="Institucional" links={institucional} />
          <Grupo titulo="Políticas" links={politicas} />
        </div>

        {/* Clube */}
        <div className="mt-12 flex flex-col small:flex-row items-start small:items-center justify-between gap-4 border border-eclat-luz/15 p-6">
          <div>
            <p className="font-serif text-2xl">Clube Éclat</p>
            <p className="text-sm text-eclat-luz/70">Lançamentos antes de todo mundo e condições só para o grupo.</p>
          </div>
          <a
            href={linkClube}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-eclat-terracota text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 hover:bg-eclat-terracota-claro transition-colors"
          >
            <Icone d={ICONE_WHATSAPP} className="h-4 w-4" />
            Quero entrar
          </a>
        </div>

        {/* pagamento e segurança */}
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <span className="text-sm text-eclat-luz/80">Formas de pagamento</span>
          <ul className="flex flex-wrap justify-center gap-2">
            {FORMAS_DE_PAGAMENTO.map((f) => (
              <li key={f} className="bg-eclat-luz text-eclat-grafite text-xs font-semibold px-3 py-1.5 rounded">
                {f}
              </li>
            ))}
          </ul>
          <p className="text-xs text-eclat-luz/60">
            Pagamento processado pelo Mercado Pago · Site protegido com HTTPS
          </p>
        </div>

        <div className="mt-12 border-t border-eclat-luz/15 pt-8 flex flex-col small:flex-row gap-4 small:items-end justify-between">
          <IdentificacaoDaEmpresa nome="fantasia" className="text-eclat-luz/60" />
          <span className="text-xs uppercase tracking-widest text-eclat-terracota-claro">A luz da mulher inteira</span>
        </div>
      </div>
    </footer>
  );
}
