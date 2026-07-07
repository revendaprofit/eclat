// Config de marketing/rastreamento — editável no Cockpit (site_content key "marketing").
// IDs públicos (seguros no cliente). O token da CAPI (secreto) fica em env server-side.
export type Marketing = {
  gtm_id?: string // GTM-XXXXXXX (hub: GA4, Pixel, Google Ads configurados dentro do GTM)
  ga4_id?: string // G-XXXXXXX (informativo / uso server-side opcional)
  meta_pixel_id?: string // usado pela CAPI server-side
  google_ads_id?: string // AW-XXXXXXX (informativo)
  gsc_verification?: string // conteúdo da meta google-site-verification
}
