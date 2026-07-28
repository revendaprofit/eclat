"use client"

import { openWizard } from "./prefs"

// Botão "Minha ÉCLAT" no menu — reabre o wizard de personalização.
export default function PersonalizeTrigger() {
  return (
    <button
      onClick={openWizard}
      className="hover:text-eclat-terracota transition-colors"
      aria-label="Personalizar minha loja"
    >
      Minha ÉCLAT
    </button>
  )
}
