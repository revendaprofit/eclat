<#
  setup-maquina.ps1 — prepara a pasta raiz da ÉCLAT neste computador.

  Cria, na pasta PAI do clone (a "raiz"):
    brand-assets\      junction -> Drive USE.ÉCLAT\brand-assets      (fotos, logos, backups)
    contexto-claude\   junction -> Drive USE.ÉCLAT\contexto-claude   (contexto operacional do Claude)
    CLAUDE.md          instruções da raiz, que importam contexto-claude\INDICE.md

  Pode rodar quantas vezes quiser. Nunca apaga nem sobrescreve pasta REAL ou arquivo que já exista.
  Única coisa que ele refaz: um link (junction) que aponte para o lugar errado, por exemplo depois de a
  pasta do Drive mudar de nome (USE.ÉCLAT virou ÉCLAT ADMINISTRATIVO em 2026-09-18). Refazer o link não
  toca no conteúdo do Drive.
  Pré-requisito: Google Drive para computador instalado e o atalho da pasta USE.ÉCLAT adicionado ao "Meu Drive".

  Uso:  powershell -ExecutionPolicy Bypass -File scripts\setup-maquina.ps1
#>
param(
  [string]$Raiz = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)
$ErrorActionPreference = "Stop"
$IdPastaDrive = "1dC5MNA-6AghufSgM9nODKAXY5ZQrzsgH"   # id da pasta USE.ÉCLAT no Google Drive (não é segredo)
$Links = @("brand-assets", "contexto-claude")

Write-Host "Raiz da ECLAT neste computador: $Raiz"
if (@("Meu Drive", "My Drive", "OneDrive", "Dropbox") | Where-Object { $Raiz -like "*$_*" }) {
  throw "A raiz esta dentro de uma pasta sincronizada. O clone do git nao pode ficar no Drive/OneDrive/Dropbox."
}

# 1) Achar a pasta USE.ÉCLAT. Dois casos:
#    a) quem recebeu a pasta por compartilhamento: <letra>:\.shortcut-targets-by-id\<id>\<nome>
#    b) quem é dona da pasta: <letra>:\Meu Drive\USE.ÉCLAT (ou "My Drive")
$use = $null
foreach ($d in Get-PSDrive -PSProvider FileSystem) {
  $p = Join-Path $d.Root ".shortcut-targets-by-id\$IdPastaDrive"
  if (Test-Path -LiteralPath $p) {
    $use = Get-ChildItem -LiteralPath $p -Directory | Select-Object -First 1
    if ($use) { break }
  }
}
if (-not $use) {
  foreach ($d in Get-PSDrive -PSProvider FileSystem) {
    foreach ($meu in @("Meu Drive", "My Drive")) {
      $p = Join-Path $d.Root $meu
      if (Test-Path -LiteralPath $p) {
        $use = Get-ChildItem -LiteralPath $p -Directory | Where-Object { $_.Name -like "USE.?CLAT" -or $_.Name -like "?CLAT ADMINISTRATIVO" } | Select-Object -First 1
        if ($use) { break }
      }
    }
    if ($use) { break }
  }
}
if (-not $use) {
  Write-Host ""
  Write-Host "NAO ACHEI a pasta ECLAT ADMINISTRATIVO (antiga USE.ECLAT) no Google Drive deste computador." -ForegroundColor Yellow
  Write-Host "1. Confira se o Google Drive para computador esta aberto e logado."
  Write-Host "2. Em drive.google.com > Compartilhados comigo > botao direito em ECLAT ADMINISTRATIVO >"
  Write-Host "   Organizar > Adicionar atalho > Meu Drive."
  Write-Host "3. Espere um minuto e rode este script de novo."
  exit 1
}
Write-Host "Pasta do Drive encontrada: $($use.FullName)"

# 2) Criar os junctions
$pendencias = @()
foreach ($nome in $Links) {
  $alvo = Join-Path $use.FullName $nome
  $link = Join-Path $Raiz $nome
  if (-not (Test-Path -LiteralPath $alvo)) {
    $pendencias += "A pasta '$nome' ainda nao existe no Drive. Peca ao socio para concluir a migracao."
    continue
  }
  $item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
  if ($item) {
    if ($item.LinkType -eq "Junction") {
      $destinoAtual = [string]($item.Target | Select-Object -First 1)
      if ($destinoAtual -eq $alvo -and (Test-Path -LiteralPath $destinoAtual)) { Write-Host "ok  $nome (link ja existia)"; continue }
      # Link aponta para outro lugar ou para pasta que sumiu (ex.: pasta do Drive renomeada).
      # rmdir em junction apaga SO o link, nunca o conteudo do destino.
      Write-Host "link antigo de $nome apontava para $destinoAtual. Refazendo."
      cmd /c rmdir "$link"
    } else {
      $pendencias += "Ja existe uma pasta REAL '$link'. Nao mexi. Renomeie-a e rode de novo."
      continue
    }
  }
  cmd /c mklink /J "$link" "$alvo" | Out-Null
  $n = (Get-ChildItem -LiteralPath $link -Force | Measure-Object).Count
  Write-Host "ok  $nome -> Drive ($n itens)"
}

# 3) CLAUDE.md da raiz (só se não existir)
$claude = Join-Path $Raiz "CLAUDE.md"
if (Test-Path -LiteralPath $claude) {
  Write-Host "ok  CLAUDE.md da raiz ja existia (nao alterei)"
} else {
  $texto = @'
# ÉCLAT — pasta raiz (este arquivo é local; gerado por eclat/scripts/setup-maquina.ps1)

Duas pessoas trabalham neste projeto, cada uma no seu computador e na sua sessão do Claude Code.
Esta pasta raiz tem a mesma forma nos dois computadores:

- `eclat/` — clone do git (GitHub `revendaprofit/eclat`, repositório PÚBLICO). A lei do código é `eclat/CLAUDE.md`.
- `brand-assets/` — link para o Google Drive da ÉCLAT. Fotos, logos e backups. O que for salvo aqui aparece no outro computador.
- `contexto-claude/` — link para o Google Drive da ÉCLAT. Contexto operacional compartilhado entre as duas sessões.

## Regras
1. Código só viaja por git. Antes de começar: `git pull`. Mudança em branch própria, com commit. Push é da pessoa, não do Claude.
2. O clone do git nunca fica dentro do Google Drive.
3. Nada de segredo no git nem no Drive. `.env` fica só no computador; a fonte é Railway e Vercel.
4. O repositório é público: conhecimento operacional (contas, preços, como fazer deploy, pendências) vai em `contexto-claude/`, não em `eclat/`.
5. Caminhos sempre relativos a esta raiz. Nunca escrever letra de drive em código, script ou documentação.
6. Aprendeu algo que a outra sessão precisa saber? Atualize o arquivo do assunto em `contexto-claude/` e o índice.

@contexto-claude/INDICE.md
'@
  [System.IO.File]::WriteAllText($claude, $texto, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "ok  CLAUDE.md da raiz criado"
}

Write-Host ""
if ($pendencias.Count) {
  Write-Host "PENDENCIAS:" -ForegroundColor Yellow
  $pendencias | ForEach-Object { Write-Host " - $_" }
  exit 2
}
Write-Host "Tudo pronto." -ForegroundColor Green
