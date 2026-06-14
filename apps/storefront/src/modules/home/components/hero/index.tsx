import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  return (
    <div className="h-[80vh] w-full border-b border-eclat-pedra/40 relative bg-gradient-to-b from-eclat-luz to-eclat-areia">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center px-6 small:px-32 gap-8">
        <span className="flex flex-col items-center gap-4">
          <span className="uppercase tracking-[0.35em] text-xs text-eclat-dourado">
            use.ÉCLAT
          </span>
          <h1 className="font-serif text-5xl small:text-7xl leading-[1.05] text-eclat-grafite font-medium max-w-3xl">
            A luz da mulher inteira
          </h1>
          <p className="text-base small:text-lg text-eclat-grafite/70 max-w-xl">
            Athleisure premium para quem se move com presença. Tecidos que
            sustentam, caimento que valoriza, brilho que é seu.
          </p>
        </span>
        <LocalizedClientLink
          href="/store"
          className="inline-flex items-center justify-center px-8 py-3 bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors duration-200"
        >
          Explorar a coleção
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Hero
