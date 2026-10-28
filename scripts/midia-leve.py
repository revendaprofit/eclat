# -*- coding: utf-8 -*-
"""
Mídia leve no site inteiro (sócia, 2026-10-27: "nunca mais deixe o site com materiais pesados com possibilidade de
erro no 4G"). Diagnóstico do funil: o vídeo que abria a página do anúncio tinha 9 MB; havia vídeo de página de 16 MB.

O que faz, em tudo que está EM USO (vídeos das peças em product.metadata.videos e vídeos/capas da home em
site_content: hero, home.instagram, home.manifesto, home.detalhes):
  - vídeo acima de LIMITE_VIDEO: refaz em até 720 px de largura, sem som, H.264 com início rápido, mirando ~1 MB;
  - capa (jpg/png) acima de LIMITE_FOTO: refaz em até 720 px, JPEG 82.
Sobe com nome novo (`-leve-<hash>`), troca o endereço onde ele aparece e guarda backup em brand-assets/.
Rodar de novo só mexe no que ainda estiver pesado.

Uso:
  python -B scripts/midia-leve.py           # simulação: comprime em pasta temporária e mostra antes → depois
  python -B scripts/midia-leve.py --apply   # grava em PRODUÇÃO (só com "pode aplicar")
Precisa do ffmpeg no PATH. Credenciais: apps/cockpit/.env.local.
"""
import datetime, hashlib, io, json, os, re, subprocess, sys, tempfile
import requests
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

APPLY = "--apply" in sys.argv
LIMITE_VIDEO = int(1.3 * 1024 * 1024)
ALVO_VIDEO = int(1.0 * 1024 * 1024)
LIMITE_FOTO = 160 * 1024
CHAVES_SC = ["hero", "home.instagram", "home.manifesto", "home.detalhes"]
PUBLICO = "/storage/v1/object/public/site/"
RE_URL = re.compile(r"https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/site/[^\"\s?]+\.(?:mp4|mov|webm|jpg|jpeg|png)", re.I)

def baixar(url):
    r = requests.get(url, timeout=300); r.raise_for_status(); return r.content

def duracao(arq):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq], capture_output=True, text=True).stdout
    return float(out.strip() or 8)

def video_leve(data, pasta):
    ent = os.path.join(pasta, "ent.mp4"); sai = os.path.join(pasta, "sai.mp4")
    open(ent, "wb").write(data)
    dur = max(1.0, duracao(ent))
    kbps = int(ALVO_VIDEO * 8 / dur / 1000 * 0.95)
    for tentativa in range(3):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ent, "-an", "-vf", "scale='min(720,iw)':-2,format=yuv420p",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-maxrate", "%dk" % kbps, "-bufsize", "%dk" % (kbps * 2),
                        "-movflags", "+faststart", sai], check=True)
        nova = open(sai, "rb").read()
        if len(nova) <= LIMITE_VIDEO: return nova
        kbps = int(kbps * 0.75)
    return nova

def foto_leve(data):
    im = Image.open(io.BytesIO(data)).convert("RGB"); im.thumbnail((720, 2000))
    b = io.BytesIO(); im.save(b, "JPEG", quality=82, optimize=True, progressive=True); return b.getvalue()

def caminho(url): return url.split(PUBLICO, 1)[1]

def novo_destino(cam, data, ext):
    base = re.sub(r"(-leve)?(-[0-9a-f]{8})?\.[a-z0-9]+$", "", cam, flags=re.I)
    return "%s-leve-%s.%s" % (base, hashlib.md5(data).hexdigest()[:8], ext)

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = fd.env(); api = fd.Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}

    produtos = api.get("/admin/products?limit=200&fields=id,handle,metadata")["products"]
    sc = requests.get("%s/rest/v1/site_content?select=key,value&key=in.(%s)" % (sb, ",".join('"%s"' % k for k in CHAVES_SC)), headers=SH, timeout=30).json()
    em_uso = set()
    for p in produtos:
        v = (p.get("metadata") or {}).get("videos")
        if v: em_uso.update(RE_URL.findall(v if isinstance(v, str) else json.dumps(v)))
    for r in sc: em_uso.update(RE_URL.findall(json.dumps(r["value"])))

    troca, uploads, total_antes, total_depois = {}, [], 0, 0
    with tempfile.TemporaryDirectory() as pasta:
        for url in sorted(em_uso):
            ext = url.rsplit(".", 1)[1].lower(); video = ext in ("mp4", "mov", "webm")
            tam = int(requests.head(url, timeout=60).headers.get("content-length") or 0)
            if tam <= (LIMITE_VIDEO if video else LIMITE_FOTO): continue
            data = baixar(url)
            nova = video_leve(data, pasta) if video else foto_leve(data)
            dest = novo_destino(caminho(url), nova, "mp4" if video else "jpg")
            troca[url] = sb + PUBLICO + dest; uploads.append((dest, nova, "video/mp4" if video else "image/jpeg"))
            total_antes += tam; total_depois += len(nova)
            print("%6.2f MB → %5.2f MB  %s" % (tam / 1048576, len(nova) / 1048576, caminho(url)))
    print("total: %.1f MB → %.1f MB em %d arquivos" % (total_antes / 1048576, total_depois / 1048576, len(uploads)))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return
    if not troca: return

    agora = datetime.datetime.now().strftime("%Y-%m-%d-%H%M")
    bk = os.path.join(PROJ, "brand-assets", "backup-midia-leve-%s.json" % agora)
    with io.open(bk, "w", encoding="utf-8") as f:
        json.dump({"videos": {p["handle"]: (p.get("metadata") or {}).get("videos") for p in produtos}, "site_content": sc, "troca": troca}, f, ensure_ascii=False, indent=1)
    for dest, data, tipo in uploads:
        up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=300)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))

    def trocar(s):
        for a, b in troca.items(): s = s.replace(a, b)
        return s
    for p in produtos:
        meta = p.get("metadata") or {}; v = meta.get("videos")
        if not v: continue
        texto = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
        if trocar(texto) != texto:
            api.post("/admin/products/%s" % p["id"], {"metadata": dict(meta, videos=trocar(texto))})
            print("produto:", p["handle"])
    for r in sc:
        texto = json.dumps(r["value"], ensure_ascii=False)
        if trocar(texto) != texto:
            w = requests.post("%s/rest/v1/site_content?on_conflict=key" % sb, headers=dict(SH, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}),
                              json={"key": r["key"], "value": json.loads(trocar(texto)), "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, timeout=30)
            print("site_content:", r["key"], "ok" if w.ok else "ERRO %s" % w.status_code)
    print("aplicado | backup:", os.path.basename(bk))

if __name__ == "__main__":
    main()
