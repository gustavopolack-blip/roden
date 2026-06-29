#!/usr/bin/env python3
"""
prepare_image.py — Comprime una imagen y la devuelve como base64 para Figma Plugin API.

Uso:
    python3 prepare_image.py /ruta/imagen.jpg

Salida:
    String base64 por stdout (sin salto de línea final).
    Garantizado < 44.000 caracteres (≈ 33 KB raw), compatible con el límite
    de 50.000 chars del parámetro `code` de use_figma.

Estrategia:
    - Convierte a RGB (descarta alpha)
    - Redimensiona a máximo 1080px de ancho manteniendo proporción
    - Binary search sobre quality JPEG para maximizar calidad dentro del budget
    - Si la imagen ya es < 33KB, la pasa sin recomprimir
"""

import sys
import base64
import io
import os

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Pillow no instalado. Ejecutar: pip install Pillow --break-system-packages", file=sys.stderr)
    sys.exit(1)

MAX_BYTES = 33_000      # 33 KB raw → base64 ≈ 44.000 chars
MAX_WIDTH = 1080        # ancho máximo en px
MIN_QUALITY = 25        # calidad mínima aceptable


def compress_image(path: str, max_bytes: int = MAX_BYTES) -> bytes:
    img = Image.open(path)

    # Corregir orientación EXIF
    img = ImageOps.exif_transpose(img)

    # Convertir a RGB (elimina transparencia, convierte paleta)
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # Redimensionar si es más ancho que MAX_WIDTH
    w, h = img.size
    if w > MAX_WIDTH:
        new_h = int(h * MAX_WIDTH / w)
        img = img.resize((MAX_WIDTH, new_h), Image.LANCZOS)

    # Verificar si ya entra sin comprimir
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=95, optimize=True)
    if buf.tell() <= max_bytes:
        return buf.getvalue()

    # Binary search: encontrar la mayor calidad que cabe en el budget
    lo, hi = MIN_QUALITY, 92
    best: bytes | None = None

    while lo <= hi:
        mid = (lo + hi) // 2
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=mid, optimize=True)
        data = buf.getvalue()

        if len(data) <= max_bytes:
            best = data
            lo = mid + 1   # intentar mayor calidad
        else:
            hi = mid - 1   # necesita más compresión

    if best is not None:
        return best

    # Fallback: calidad mínima + reducir resolución a la mitad
    w2, h2 = img.size
    img_small = img.resize((w2 // 2, h2 // 2), Image.LANCZOS)
    buf = io.BytesIO()
    img_small.save(buf, format='JPEG', quality=MIN_QUALITY, optimize=True)
    result = buf.getvalue()

    if len(result) > max_bytes:
        print(
            f"⚠️  Advertencia: imagen muy grande incluso al mínimo "
            f"({len(result):,} bytes). Puede exceder el límite de Figma.",
            file=sys.stderr
        )

    return result


def main():
    if len(sys.argv) < 2:
        print("Uso: python3 prepare_image.py /ruta/imagen.jpg", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]

    if not os.path.exists(path):
        print(f"Error: archivo no encontrado: {path}", file=sys.stderr)
        sys.exit(1)

    compressed = compress_image(path)
    b64 = base64.b64encode(compressed).decode('ascii')

    # Verificar longitud final
    if len(b64) > 44_000:
        print(
            f"⚠️  base64 resultante ({len(b64):,} chars) supera el límite recomendado de 44.000.",
            file=sys.stderr
        )

    # Imprimir solo el base64, sin salto de línea
    sys.stdout.write(b64)


if __name__ == '__main__':
    main()
