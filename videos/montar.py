"""Monta un vídeo vertical 1080x1920 para TikTok/Shorts a partir de:
- videos/voz_<cat>.mp3 (voz ElevenLabs ya recortada)
- videos/guiones.json (texto, gancho y productos)
- clips de stock en <clips>/<cat>/{intro,p0,p1,p2,p3}_N.mp4
- videos/web_<cat>.mp4 (clip navegando por la web, para el final)
- opcional: música de fondo libre de derechos

Uso: python3 montar.py <categoria> <carpeta_clips> <salida.mp4> [musica.mp3]
"""
import json, os, re, subprocess, sys, tempfile, random

W, H, FPS = 1080, 1920, 30
AQUI = os.path.dirname(os.path.abspath(__file__))
NARANJA = "&H000C58EA&"  # #ea580c en BGR de ASS
SHOT = 1.25  # segundos por plano: cortes rápidos para retener


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duracion(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "csv=p=0", path])
    return float(out)


def tramos_con_voz(voz):
    """Intervalos (inicio, fin) donde hay voz, separados por silencios."""
    err = subprocess.run(["ffmpeg", "-i", voz, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    fin = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    total = duracion(voz)
    tramos, t = [], 0.0
    for s, e in zip(ini, fin + [total] * (len(ini) - len(fin))):
        if s > t + 0.05:
            tramos.append((t, s))
        t = e
    if t < total - 0.05:
        tramos.append((t, total))
    return tramos


def alinear(texto, tramos):
    """Reparte las palabras del guion sobre el tiempo con voz, proporcional a su longitud."""
    palabras = texto.split()
    pesos = [len(re.sub(r"\W", "", p)) + 1.5 for p in palabras]
    hablado = sum(e - s for s, e in tramos)
    por_peso = hablado / sum(pesos)
    res, i_tramo, t = [], 0, tramos[0][0]
    for p, w in zip(palabras, pesos):
        d = w * por_peso
        s, e = tramos[i_tramo]
        if t >= e - 0.01 and i_tramo + 1 < len(tramos):
            i_tramo += 1
            s, e = tramos[i_tramo]
            t = s
        res.append([p, t, t + d])
        t += d
        if t > e and i_tramo + 1 < len(tramos):
            sobra = t - e
            i_tramo += 1
            t = tramos[i_tramo][0] + sobra
    return res


def buscar(palabras, frase):
    objetivo = [re.sub(r"\W", "", x).lower() for x in frase.split()]
    limpias = [re.sub(r"\W", "", p[0]).lower() for p in palabras]
    for i in range(len(limpias)):
        if limpias[i:i + len(objetivo)] == objetivo:
            return palabras[i][1]
    raise ValueError(f"No encuentro '{frase}' en el guion")


def ts(t):
    h, r = divmod(max(t, 0), 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ass(palabras, guion, marcas, total, ruta):
    """Subtítulos palabra a palabra, gancho, etiquetas de producto, cuenta y barra de progreso."""
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,9,4,2,60,60,560,1
Style: Gancho,Inter,104,&H00FFFFFF,&H00FFFFFF,{NARANJA},&H00000000,-1,0,0,0,100,100,0,0,3,26,0,8,70,70,330,1
Style: Badge,Inter,78,&H00FFFFFF,&H00FFFFFF,{NARANJA},&H00000000,-1,0,0,0,100,100,0,0,3,22,0,8,70,70,300,1
Style: Cuenta,Inter,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,3,14,0,9,40,50,120,1
Style: Cta,Inter,82,&H00FFFFFF,&H00FFFFFF,{NARANJA},&H00000000,-1,0,0,0,100,100,0,0,3,24,0,8,60,60,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    pop = r"{\fscx70\fscy70\t(0,120,\fscx112\fscy112)\t(120,220,\fscx100\fscy100)}"
    # Subtítulos: grupos de 2-3 palabras, la palabra que suena en naranja y un poco más grande
    grupo = []
    grupos = []
    for p in palabras:
        grupo.append(p)
        if len(grupo) == 3 or re.search(r"[.,:?!…]$", p[0]):
            grupos.append(grupo)
            grupo = []
    if grupo:
        grupos.append(grupo)
    cta_t = marcas["cta"]
    for g in grupos:
        for k, (pal, s, e) in enumerate(g):
            fin = g[k + 1][1] if k + 1 < len(g) else e + 0.08
            txt = []
            for j, (q, _, _) in enumerate(g):
                q = q.upper()
                if j == k:
                    txt.append(r"{\c" + NARANJA + r"\fscx115\fscy115}" + q + r"{\c&H00FFFFFF&\fscx100\fscy100}")
                else:
                    txt.append(q)
            estilo = "Sub"
            ev.append(f"Dialogue: 1,{ts(s)},{ts(fin)},{estilo},,0,0,0,,{' '.join(txt)}")
    # Gancho en grande los primeros segundos
    ev.append(f"Dialogue: 2,{ts(0)},{ts(min(marcas['p'][0], 2.6))},Gancho,,0,0,0,,{pop}{guion['gancho']}")
    # Etiqueta de cada producto y cuenta 1/4, 2/4...
    n = len(guion["productos"])
    for i, prod in enumerate(guion["productos"]):
        s = marcas["p"][i]
        e = marcas["p"][i + 1] if i + 1 < n else cta_t
        ev.append(f"Dialogue: 2,{ts(s)},{ts(e)},Badge,,0,0,0,,{pop}Nº {prod['n']} · {prod['nombre'].upper()}")
        ev.append(f"Dialogue: 2,{ts(s)},{ts(e)},Cuenta,,0,0,0,,{pop}{i + 1}/{n}")
    if "flash" in marcas:
        a, b = marcas["flash"]
        ev.append(f"Dialogue: 3,{ts(a)},{ts(b)},Cta,,0,0,0,,{pop}LOS 4 ESTÁN EN\\NTUCASARESUELTA.COM")
    ev.append(f"Dialogue: 2,{ts(cta_t)},{ts(total)},Cta,,0,0,0,,{pop}ENLACES EN\\NTUCASARESUELTA.COM")
    with open(ruta, "w") as f:
        f.write(cab + "\n".join(ev) + "\n")


def plano(src, ini, dur, sal, zoom_in=True):
    """Recorta un plano del clip, lo pone en vertical a pantalla completa y le da un zoom suave."""
    z0, z1 = (1.0, 1.12) if zoom_in else (1.12, 1.0)
    zexpr = f"{z0}+({z1}-{z0})*t/{dur}"
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},"
          f"scale=w='trunc({W}*({zexpr})/2)*2':h=-2:eval=frame,crop={W}:{H},"
          f"fps={FPS},eq=contrast=1.06:saturation=1.18,unsharp=5:5:0.6,format=yuv420p")
    run(["ffmpeg", "-y", "-ss", f"{ini:.3f}", "-t", f"{dur:.3f}", "-i", src, "-an", "-vf", vf,
         "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", sal])


def sonido_whoosh(ruta):
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=d=0.35:c=pink:a=0.6",
         "-af", "highpass=f=400,lowpass=f=6000,afade=t=in:d=0.12,afade=t=out:st=0.15:d=0.2,volume=0.5",
         "-ar", "44100", "-ac", "2", ruta])


def montar(cat, carpeta_clips, salida, musica=None):
    guiones = json.load(open(os.path.join(AQUI, "guiones.json")))
    guion = guiones[cat]
    voz = os.environ.get("VOZ") or os.path.join(AQUI, f"voz_{cat}.mp3")
    web = os.path.join(AQUI, f"web_{cat}.mp4")
    total = duracion(voz) + 0.4
    palabras = alinear(guion["texto"], tramos_con_voz(voz))
    marcas = {"p": [buscar(palabras, p["dice"]) for p in guion["productos"]],
              "cta": buscar(palabras, "Todos los modelos")}
    # El último plano del 2º producto se sustituye por un fogonazo de la web
    a, b = marcas["p"][1], marcas["p"][2]
    marcas["flash"] = (b - (b - a) / max(1, round((b - a) / SHOT)), b)
    tmp = tempfile.mkdtemp(prefix=f"montaje_{cat}_")
    ass(palabras, guion, marcas, total, os.path.join(tmp, "subs.ass"))

    # Segmentos: intro, cada producto y el final con la web
    cortes = [0.0] + marcas["p"] + [marcas["cta"]]
    claves = ["intro"] + [f"p{i}" for i in range(len(guion["productos"]))]
    clips_dir = os.path.join(carpeta_clips, cat)
    planos, cortes_t, t_acum = [], [], 0.0
    rnd = random.Random(cat)
    for k, clave in enumerate(claves):
        fuentes = sorted(f for f in os.listdir(clips_dir) if f.startswith(clave + "_"))
        if not fuentes:
            raise SystemExit(f"Faltan clips para {cat}/{clave}")
        largo = cortes[k + 1] - cortes[k]
        n = max(1, round(largo / SHOT))
        d = largo / n
        for j in range(n):
            if clave == "p1" and j == n - 1 and n > 1:
                sal = os.path.join(tmp, f"plano_{len(planos):03d}.mp4")
                run(["ffmpeg", "-y", "-ss", "2.0", "-t", f"{d:.3f}", "-i", web, "-an", "-vf",
                     f"scale={W}:{H},fps={FPS},format=yuv420p,tpad=stop_mode=clone:stop_duration=5",
                     "-t", f"{d:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", sal])
                planos.append(sal)
                cortes_t.append(t_acum)
                t_acum += d
                continue
            src = os.path.join(clips_dir, fuentes[j % len(fuentes)])
            dsrc = duracion(src)
            ini = 0.0 if dsrc <= d + 0.2 else rnd.uniform(0, dsrc - d - 0.1) if j >= len(fuentes) else min(dsrc * 0.3, dsrc - d - 0.1)
            sal = os.path.join(tmp, f"plano_{len(planos):03d}.mp4")
            plano(src, max(ini, 0), d, sal, zoom_in=(len(planos) % 2 == 0))
            planos.append(sal)
            cortes_t.append(t_acum)
            t_acum += d
    # Final: la web a pantalla completa hasta que acaba la voz
    dweb = total - t_acum
    sal = os.path.join(tmp, "plano_web.mp4")
    vf = f"scale={W}:{H},fps={FPS},format=yuv420p,tpad=stop_mode=clone:stop_duration=10"
    run(["ffmpeg", "-y", "-i", web, "-an", "-vf", vf, "-t", f"{dweb:.3f}", "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "18", sal])
    planos.append(sal)
    cortes_t.append(t_acum)

    lista = os.path.join(tmp, "lista.txt")
    with open(lista, "w") as f:
        f.writelines(f"file '{p}'\n" for p in planos)
    base = os.path.join(tmp, "base.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", base])

    # Vídeo final: subtítulos + barra de progreso; audio: voz + whoosh en cada corte + música baja
    whoosh = os.path.join(tmp, "whoosh.wav")
    sonido_whoosh(whoosh)
    entradas = ["-i", base, "-i", voz]
    filtros = [f"[0:v]ass={os.path.join(tmp, 'subs.ass')},"
               f"drawbox=x=0:y=0:w=iw:h=14:color=black@0.35:t=fill,"
               f"drawbox=x=0:y=0:w='iw*t/{total:.3f}':h=14:color=0xea580c:t=fill[v]"]
    mezcla = ["[1:a]volume=1.0[voz]"]
    etiquetas = ["[voz]"]
    idx = 2
    for i, t in enumerate(cortes_t[1:]):
        entradas += ["-i", whoosh]
        ms = int(max(t - 0.12, 0) * 1000)
        mezcla.append(f"[{idx}:a]adelay={ms}|{ms},volume=0.35[w{i}]")
        etiquetas.append(f"[w{i}]")
        idx += 1
    if musica:
        entradas += ["-stream_loop", "-1", "-i", musica]
        mezcla.append(f"[{idx}:a]volume=0.11,afade=t=out:st={total - 1.2:.2f}:d=1.2[mus]")
        etiquetas.append("[mus]")
    mezcla.append("".join(etiquetas) + f"amix=inputs={len(etiquetas)}:normalize=0,"
                  f"alimiter=limit=0.95,atrim=0:{total:.3f}[a]")
    run(["ffmpeg", "-y", *entradas, "-filter_complex", ";".join(filtros + mezcla),
         "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", "medium",
         "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-ar", "44100", "-movflags", "+faststart", salida])
    print(f"{salida}: {total:.1f} s, {len(planos)} planos")


if __name__ == "__main__":
    montar(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
