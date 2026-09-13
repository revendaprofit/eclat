// Interruptor global da "Minha ÉCLAT" (personas): `site_content.personas = { ativo: boolean }`,
// editado no Cockpit → Personas. Chave ausente ou valor inválido → ativo (comportamento original).
export function personasAtivasDe(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return true
  const ativo = (valor as { ativo?: unknown }).ativo
  return typeof ativo === "boolean" ? ativo : true
}
