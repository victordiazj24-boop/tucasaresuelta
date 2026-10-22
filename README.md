# Casa Resuelta · tucasaresuelta.com

Web de afiliados de Amazon generada a partir de unos pocos archivos de datos. No necesita WordPress, base de datos ni plugins: `node build.js` crea la carpeta `dist/` con todas las páginas listas para subir.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `data/productos.json` | **El catálogo.** Un bloque por producto. Es lo único que tocas para añadir productos. |
| `data/categorias.json` | Las categorías del menú (Cocina, Limpieza…). |
| `data/problemas.json` | Los "¿Qué quieres resolver?" de la portada. |
| `data/guias.json` | Las listas tipo "Los 10 mejores…". Cada guía es una lista de números de producto. |
| `data/config.json` | Nombre, dominio, tu ID de afiliado (`casaresuelta-21`) y tus redes sociales. |
| `src/` | Diseño (`style.css`) e interactividad (`app.js`). |
| `build.js` | Genera la web en `dist/`. |

## Añadir un producto nuevo (5 minutos)

1. En Amazon, con la barra de **SiteStripe**, copia el enlace del producto (vale el corto `amzn.to/...` o el largo `amazon.es/dp/...`).
2. Abre `dist/herramienta.html` en el navegador (o `tucasaresuelta.com/herramienta.html` cuando esté publicada), rellena el formulario y pulsa **Copiar bloque**.
3. Pega el bloque al final de `data/productos.json`, justo antes del último `]`.
4. Ejecuta `node build.js`. Si falta algo o un número está repetido, te lo dice y no genera nada.
5. Sube la carpeta `dist/` (ver "Publicar").

Reglas sencillas:
- **`numero`** es el número que dirás en el vídeo ("el Nº 11"). Nunca lo reutilices.
- Si pegas un enlace largo de amazon.es, el tag `casaresuelta-21` se añade solo. Los enlaces cortos de SiteStripe ya lo llevan.
- Cada producto es un **modelo concreto** con enlace directo (`https://www.amazon.es/dp/ASIN` o el enlace corto de SiteStripe). No uses enlaces de búsqueda ni productos genéricos.
- Para que salga en la portada arriba, pon `"destacado": true`.
- Si cambias el `slug` de un producto ya publicado, añade el antiguo en `"slugsAnteriores"`: la dirección vieja redirige sola a la nueva.
- Las guías y categorías admiten `"secciones"` (título y texto) y `"faq"` (preguntas y respuestas). Es el texto que más ayuda a salir en Google.
- Cuando publiques el TikTok o el Short, pega su enlace en `videos.tiktok` / `videos.youtube` y vuelve a generar: aparecerá un botón en la ficha.
- **Imagen (opcional):** usa la imagen que da SiteStripe (pestaña "Imagen") o una foto tuya en `src/img/` y escribe `"imagen": "assets/img/nombre.jpg"`. No descargues fotos de Amazon a mano: sus normas lo prohíben.
- **No pongas precios.** Amazon solo permite mostrarlos si se actualizan automáticamente; por eso los botones dicen "Ver precio en Amazon".

## Publicar

`dist/` es una web estática: vale cualquier hosting.

- **Hosting de DonDominio:** sube el contenido de `dist/` a la carpeta `public_html` por FTP (FileZilla) o desde el gestor de archivos del panel.
- **Gratis con GitHub Pages o Cloudflare Pages:** sube `dist/` y apunta el dominio desde el panel DNS de DonDominio. `dist/CNAME` ya lleva `www.tucasaresuelta.com`.

La entrada antigua del blog se mantiene en la misma dirección (`/2026/09/los-10-mejores-productos-para-el-hogar.html`) para no perder lo que Google ya tenga indexado.

Después de publicar, da de alta `https://www.tucasaresuelta.com/sitemap.xml` en Google Search Console.

## Páginas que genera

- Portada con buscador, filtros por problema y categoría, favoritos y comparador de hasta 3 productos.
- Una ficha por producto (`producto/…`), una página por categoría (`categoria/…`) y una por guía.
- `videos.html`: la página para el enlace de la bio de TikTok y YouTube. Se puede enlazar directa a un producto con `videos.html#n7`.
- `sitemap.xml`, `robots.txt`, aviso legal y página 404.
