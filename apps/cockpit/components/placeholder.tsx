export default function Placeholder({
  titulo,
  fase,
  descricao,
}: {
  titulo: string
  fase: string
  descricao: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-4xl text-eclat-grafite">{titulo}</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">{descricao}</p>
      </div>
      <div className="border border-dashed border-eclat-pedra/50 rounded-lg p-8 text-center">
        <span className="uppercase tracking-[0.3em] text-[10px] text-eclat-dourado">
          {fase}
        </span>
        <p className="text-eclat-grafite/60 mt-2">Em construção</p>
      </div>
    </div>
  )
}
