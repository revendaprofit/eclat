// Entrega por aplicativo: a cliente chama e paga o carro (Uber, 99, motoboy) e combina a retirada
// por WhatsApp depois do pagamento. O texto é o mesmo que o backend grava no pedido como aceite
// (`apps/backend/src/modules/entrega-app/service.ts`) — se mudar lá, mude aqui.

export const TEXTO_ENTREGA_APP =
  "Você chama e paga o carro (Uber, 99, motoboy). A use.ÉCLAT entrega a sacola ao motorista no " +
  "endereço e horário combinados por WhatsApp; a contratação e o transporte são de sua responsabilidade."

export function ehEntregaPorApp(opcao?: { provider_id?: string | null } | null): boolean {
  return (opcao?.provider_id ?? "").includes("entrega-app")
}
