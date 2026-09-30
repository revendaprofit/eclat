# -*- coding: utf-8 -*-
"""
Grade "Acompanhe @eclat.use" da home (site_content "home.instagram").

As URLs de imagem do Instagram expiram em poucos dias, então as fotos são BAIXADAS e guardadas no Storage do site
(`site/instagram/<id>.jpg`). A lista de posts vem de um JSON [{"id","media_url","permalink"}] tirado do conector
da Meta (ads_get_ig_media, só posts de produto — nada pessoal). Completa até 6 com fotos de produto que já estão
no site (`--extras`), que levam para o perfil.

Uso:
  python scripts/instagram-home.py --posts posts.json [--extras url1,url2]            # simulação
  python scripts/instagram-home.py --posts posts.json [--extras ...] --apply          # grava em PRODUÇÃO
Credenciais: apps/cockpit/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
"""
import io, os, sys, json, datetime, requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAVE = "home.instagram"
HANDLE = "eclat.use"


def env_local():
    env = {}
    for line in io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8").read().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"')
    return env


def arg(nome):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else None


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    apply = "--apply" in sys.argv
    posts = json.load(io.open(arg("--posts"), encoding="utf-8"))
    extras = [u for u in (arg("--extras") or "").split(",") if u.startswith("https://")]
    env = env_local()
    url, chave = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": chave, "Authorization": "Bearer " + chave}

    itens = []
    for p in posts[:6]:
        dest = "instagram/%s.jpg" % p["id"]
        publica = "%s/storage/v1/object/public/site/%s" % (url, dest)
        print("post %s -> %s" % (p["permalink"], dest))
        if apply:
            img = requests.get(p["media_url"], timeout=60)
            img.raise_for_status()
            r = requests.post("%s/storage/v1/object/site/%s" % (url, dest),
                              headers=dict(H, **{"Content-Type": "image/jpeg", "x-upsert": "true"}), data=img.content, timeout=120)
            if not r.ok:
                raise RuntimeError("upload %s -> %s %s" % (dest, r.status_code, r.text[:300]))
        itens.append({"image_url": publica, "href": p["permalink"]})
    for u in extras[: max(0, 6 - len(itens))]:
        itens.append({"image_url": u, "href": "https://www.instagram.com/%s/" % HANDLE})

    valor = {"handle": HANDLE, "heading": "Acompanhe a Éclat", "items": itens}
    r = requests.get("%s/rest/v1/site_content?key=eq.%s&select=value" % (url, CHAVE), headers=H, timeout=30)
    r.raise_for_status()
    antes = r.json()[0]["value"] if r.json() else None
    print("ATUAL:", json.dumps(antes, ensure_ascii=False)[:300])
    print("NOVO :", json.dumps(valor, ensure_ascii=False, indent=1))
    if not apply:
        print("\nNada gravado. Rode com --apply para gravar em produção.")
        return
    backup = os.path.join(os.path.dirname(RAIZ), "brand-assets", "backup-site-content-instagram-%s.json" % datetime.date.today())
    with io.open(backup, "w", encoding="utf-8") as f:
        json.dump({"key": CHAVE, "value": antes}, f, ensure_ascii=False, indent=1)
    r = requests.post("%s/rest/v1/site_content?on_conflict=key" % url,
                      headers=dict(H, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}),
                      json={"key": CHAVE, "value": valor, "updated_at": datetime.datetime.utcnow().isoformat() + "Z"}, timeout=30)
    print("GRAVADO" if r.ok else "ERRO %s %s" % (r.status_code, r.text), "| backup:", backup)


if __name__ == "__main__":
    main()
