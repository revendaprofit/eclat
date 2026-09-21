import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Convite para entrar, em uma linha discreta abaixo das peças (antes era o primeiro bloco da página,
// maior que a própria sacola).
const SignInPrompt = () => {
  return (
    <p className="text-sm text-eclat-grafite/70" data-testid="sign-in-prompt">
      Já tem conta?{" "}
      <LocalizedClientLink
        href="/account"
        className="text-eclat-terracota underline underline-offset-4 hover:text-eclat-terracota-escuro"
        data-testid="sign-in-button"
      >
        Entre
      </LocalizedClientLink>{" "}
      para usar seus endereços salvos e acompanhar o pedido.
    </p>
  )
}

export default SignInPrompt
