# `/public/videos/`

Vídeos servidos como recurso estático bajo `https://<host>/videos/<file>`.

## Convenciones

- Sin audio (`-an` en ffmpeg). Todos son fondos decorativos en bucle.
- MP4 H.264 + `+faststart` para que el primer frame aparezca rápido.
- Resolución máxima 1920×1080. 4K es desperdicio para fondo borroso/viñeteado.
- Bitrate ~1.5–2.5 Mbps. Tamaño objetivo ≤ 8 MB por clip.
- Duración 8–15 s con loop perfecto (sin saltos al ciclar).

## Ficheros usados por la app

| Tema | Fichero | Dónde lo consume |
| --- | --- | --- |
| `canario` | `canario.mp4` | `components/layout/CanarioBackground.tsx` |
| `canario` (poster, opcional) | `canario-poster.jpg` | mismo (usado como `poster=` mientras carga el MP4) |

## Por qué no se versiona aquí

Los vídeos pesan demasiado para git (~1–10 MB cada uno) y se inflaría el
historial sin aportar. Se considera que cada despliegue trae su carpeta
`/public/videos/` por sus propios medios (descarga durante setup,
sincronización con CDN, etc.). Si alguien clona el repo y no copia los
MP4, el `<video onError>` del Background detecta el 404 y cae con
gracia a la capa CSS de fallback (cielo crepuscular + silueta del Teide
en CSS), así que la app no se rompe.
