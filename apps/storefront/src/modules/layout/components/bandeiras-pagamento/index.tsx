// Bandeiras de cartão e selos de pagamento desenhados em SVG (sem arquivo externo), no estilo "cartãozinho"
// que a cliente reconhece (referência bechose.com.br; pedido da sócia em 2026-10-11: "bandeiras e selos de
// segurança trazem mais confiabilidade"). As marcas são simplificadas: cor e nome da bandeira, como nos
// rodapés de loja. Aceitas pelo Mercado Pago no checkout: Visa, Mastercard, Elo, American Express, Hipercard e Pix.
const CAIXA = "h-8 w-12 shrink-0 rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,.25)]"

function Visa() {
  return (
    <svg viewBox="0 0 48 32" className={CAIXA} role="img" aria-label="Visa">
      <rect width="48" height="32" rx="5" fill="#fff" />
      <text x="24" y="21" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="15" fill="#1A1F71">
        VISA
      </text>
      <rect x="0" y="27" width="48" height="5" fill="#F7B600" />
    </svg>
  )
}
function Mastercard() {
  return (
    <svg viewBox="0 0 48 32" className={CAIXA} role="img" aria-label="Mastercard">
      <rect width="48" height="32" rx="5" fill="#000" />
      <circle cx="19" cy="16" r="9" fill="#EB001B" />
      <circle cx="29" cy="16" r="9" fill="#F79E1B" fillOpacity="0.95" />
      <path d="M24 9.3a9 9 0 0 1 0 13.4 9 9 0 0 1 0-13.4Z" fill="#FF5F00" />
    </svg>
  )
}
function Elo() {
  return (
    <svg viewBox="0 0 48 32" className={CAIXA} role="img" aria-label="Elo">
      <rect width="48" height="32" rx="5" fill="#000" />
      <circle cx="13" cy="16" r="7" fill="#FFCB05" />
      <path d="M13 9a7 7 0 0 1 6.2 3.7l-6.2 3.3V9Z" fill="#00A4E0" />
      <path d="M19.4 18.2A7 7 0 0 1 13 23v-7l6.4 2.2Z" fill="#EF4123" />
      <text x="34" y="21" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="13" fill="#fff">
        elo
      </text>
    </svg>
  )
}
function Amex() {
  return (
    <svg viewBox="0 0 48 32" className={CAIXA} role="img" aria-label="American Express">
      <rect width="48" height="32" rx="5" fill="#2E77BC" />
      <text x="24" y="20" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="11" fill="#fff">
        AMEX
      </text>
    </svg>
  )
}
function Hipercard() {
  return (
    <svg viewBox="0 0 48 32" className={CAIXA} role="img" aria-label="Hipercard">
      <rect width="48" height="32" rx="5" fill="#B3131B" />
      <text x="24" y="20" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="8.5" fill="#fff">
        Hipercard
      </text>
    </svg>
  )
}
function Pix() {
  return (
    <svg viewBox="0 0 48 32" className={CAIXA} role="img" aria-label="Pix">
      <rect width="48" height="32" rx="5" fill="#fff" />
      <path d="M14 16l5.5-5.5a2 2 0 0 1 2.8 0L24 12.2l1.7-1.7a2 2 0 0 1 2.8 0L34 16l-5.5 5.5a2 2 0 0 1-2.8 0L24 19.8l-1.7 1.7a2 2 0 0 1-2.8 0L14 16Z" fill="#32BCAD" />
      <text x="24" y="29" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="6" fill="#32BCAD">
        PIX
      </text>
    </svg>
  )
}
function MercadoPago() {
  return (
    <svg viewBox="0 0 64 32" className="h-8 w-16 shrink-0 rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,.25)]" role="img" aria-label="Mercado Pago">
      <rect width="64" height="32" rx="5" fill="#009EE3" />
      <ellipse cx="32" cy="12" rx="11" ry="6.5" fill="#fff" />
      <path d="M24 12c3-3 5-3 8 0s5 3 8 0" stroke="#009EE3" strokeWidth="1.4" fill="none" />
      <text x="32" y="27" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="6.2" fill="#fff">
        MERCADO PAGO
      </text>
    </svg>
  )
}

export default function BandeirasPagamento() {
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Formas de pagamento aceitas">
      {[Visa, Mastercard, Elo, Amex, Hipercard, Pix, MercadoPago].map((B, i) => (
        <li key={i}>
          <B />
        </li>
      ))}
    </ul>
  )
}
