"""Descarga clips reales de Pixabay (licencia libre para uso comercial) según videos/guiones.json.

Uso: PIXABAY_API_KEY=... python3 bajar_clips.py <carpeta_clips> [categoria ...]
Guarda <carpeta_clips>/<cat>/{intro,p0..p3}_N.mp4 y un registro creditos.txt con la URL de cada clip.
"""
import json, os, sys, urllib.parse, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
POR_CLAVE = 3  # clips distintos por tramo


def api(q, key):
    url = "https://pixabay.com/api/videos/?" + urllib.parse.urlencode(
        {"key": key, "q": q, "per_page": 20, "safesearch": "true", "video_type": "film"})
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)["hits"]


def mejor_archivo(hit):
    # El de 1920 px si existe; si no, el más grande disponible
    vs = [v for v in hit["videos"].values() if v.get("url")]
    vs.sort(key=lambda v: (abs(max(v["width"], v["height"]) - 1920), -v["width"]))
    return vs[0]


def bajar(carpeta, cats, key):
    guiones = json.load(open(os.path.join(AQUI, "guiones.json")))
    usados = set()
    for cat in cats:
        g = guiones[cat]
        destino = os.path.join(carpeta, cat)
        os.makedirs(destino, exist_ok=True)
        tramos = [("intro", g["intro_busquedas"])] + [(f"p{i}", p["busquedas"]) for i, p in enumerate(g["productos"])]
        with open(os.path.join(destino, "creditos.txt"), "w") as cred:
            for clave, busquedas in tramos:
                n = 0
                for q in busquedas:
                    for hit in api(q, key):
                        if n >= POR_CLAVE:
                            break
                        if hit["id"] in usados or hit["duration"] < 3:
                            continue
                        f = mejor_archivo(hit)
                        sal = os.path.join(destino, f"{clave}_{n + 1}.mp4")
                        urllib.request.urlretrieve(f["url"], sal)
                        usados.add(hit["id"])
                        cred.write(f"{clave}_{n + 1}.mp4\t{q}\t{hit['pageURL']}\t{hit['user']}\n")
                        n += 1
                    if n >= POR_CLAVE:
                        break
                print(cat, clave, n, "clips")


if __name__ == "__main__":
    key = os.environ.get("PIXABAY_API_KEY")
    if not key:
        sys.exit("Falta PIXABAY_API_KEY")
    cats = sys.argv[2:] or list(json.load(open(os.path.join(AQUI, "guiones.json"))))
    bajar(sys.argv[1], cats, key)
