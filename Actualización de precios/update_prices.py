#!/usr/bin/env python3
"""
rødën OS — Actualizador automático de lista de precios
=======================================================
Extrae precios de los PDFs del proveedor (Placas e Insumos + Herrajes)
y genera una nueva entrada en la tabla price_lists de Supabase.

Uso:
    python update_prices.py \
        --placas "Lista de Precios Placas e Insumos MAYO 2026.pdf" \
        --herrajes "Lista de Precios Herrajes y Accesorios MAYO 2026.pdf" \
        [--preview]   # Solo muestra los precios, no escribe en Supabase
        [--apply]     # Escribe en Supabase

    El nombre de la lista (mes) se detecta automáticamente del nombre del PDF.
    Si el proveedor cambia el formato del nombre, pasá --mes "Mayo 2026" manualmente.

Requiere:
    pip install pdfplumber supabase python-dotenv
"""

import re
import sys
import json
import uuid
import argparse
from datetime import date
from pathlib import Path

# ── Dependencias opcionales (se validan al inicio) ──────────────────────────
try:
    import pdfplumber
except ImportError:
    sys.exit("ERROR: Falta pdfplumber. Ejecutá: pip install pdfplumber")

try:
    from supabase import create_client
except ImportError:
    sys.exit("ERROR: Falta supabase. Ejecutá: pip install supabase")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # .env es opcional; también acepta variables de entorno directas

import os

# ── Constantes ───────────────────────────────────────────────────────────────
IVA = 1.21  # 21% IVA incluido en todos los precios finales

MESES_ES = (
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
)

def detectar_mes_desde_nombre(ruta: str) -> str | None:
    """Extrae 'Mes YYYY' del nombre del archivo PDF (ej: 'MAYO 2026' → 'Mayo 2026')."""
    nombre = Path(ruta).stem.upper()
    patron = rf"({'|'.join(MESES_ES)})\s+(\d{{4}})"
    m = re.search(patron, nombre)
    if m:
        return f"{m.group(1).capitalize()} {m.group(2)}"
    return None


def fix_split_numbers(text: str) -> str:
    """
    pdfplumber parte o fusiona numeros en PDFs de 2 columnas.
    Repara cuatro patrones de estas listas:
      D) "3.025,8414.396,94" -> "3.025,84 14.396,94"  (dos precios fusionados, PRIMERO)
      A) "7 0.940,07"  -> "70.940,07"   (digito partido con espacio)
      B) "1 .200,57"   -> "1.200,57"    (4 digits con separador de miles)
      C) "4 77,40"     -> "477,40"      (3 digits sin separador de miles)
    El orden importa: D debe ir antes de A para que A no re-fusione los decimales.
    A lleva lookbehind (?<!,) para no tocar los decimales separados por D.
    """
    # D (PRIMERO): dos precios argentinos pegados sin espacio
    # e.g. "3.025,8414.396,94" -> "3.025,84 14.396,94"
    text = re.sub(r'(\d{1,2}\.\d{3},\d{2})(\d{1,2}\.\d{3},\d{2})', r'\1 \2', text)
    # A: X X.XXX,XX  — lookbehind (?<!,) evita fusionar la parte decimal que D separo
    text = re.sub(r'(?<!,)\b(\d{1,2}) (\d{1,2}\.\d{3},\d{2})\b',
                  lambda m: m.group(1) + m.group(2), text)
    # B: X .XXX,XX
    text = re.sub(r'\b(\d) \.(\d{3},\d{2})\b', r'\1.\2', text)
    # C: X XX,XX
    text = re.sub(r'\b(\d) (\d{2},\d{2})\b', r'\1\2', text)
    return text


# ── Mapa de extracción ───────────────────────────────────────────────────────
# Cada entrada define:
#   "campo"   : nombre del campo en price_lists.settings
#   "fuente"  : "placas" o "herrajes"
#   "patron"  : regex que matchea la línea con el precio
#   "grupo"   : número de grupo de captura del precio (sin puntos de miles)
#   "nota"    : descripción legible para el preview

EXTRACTION_MAP = [

    # ── TABLEROS ─────────────────────────────────────────────────────────────

    {
        "campo": "priceBoard18WhiteAglo",
        "fuente": "placas",
        "descripcion": "Melamina blanca MDP 18mm (Faplac, $/hoja)",
        # Línea ejemplo: "18mm Aglomerado 14.103,39 70.940,07"
        # Queremos el segundo número (precio hoja 275x183)
        "patron": r"18mm Aglomerado\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "TABLEROS DE MELAMINA BLANCOS",
    },
    {
        "campo": "priceBoard18WhiteMDF",
        "fuente": "placas",
        "descripcion": "Melamina blanca MDF 18mm (Faplac, $/hoja)",
        "patron": r"18mm MDF\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "TABLEROS DE MELAMINA BLANCOS",
    },
    {
        "campo": "priceBoard18ColorAglo",
        "fuente": "placas",
        "descripcion": "Melamina color MDP 18mm — Blend/Hilados/Nature ($/hoja)",
        "patron": r"18mm Aglomerado\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "LINEA BLEND",
    },
    {
        "campo": "priceBoard18ColorMDF",
        "fuente": "placas",
        "descripcion": "Melamina texturada MDF 18mm — Egger G6 ($/hoja)",
        "patron": r"18mm MDF G6\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "GRUPO 6",
        # Buscamos dentro del bloque de Reproducción de Maderas G6
    },
    {
        "campo": "priceBoard18MDFCrudo1Face",
        "fuente": "placas",
        "descripcion": "MDF crudo 18mm Trupan ($/hoja)",
        "patron": r"MDF 18mm\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "TABLERO MDF TRUPAN",
    },
    {
        "campo": "priceBoard18VeneerMDF",
        "fuente": "placas",
        "descripcion": "Enchapado MDF 18mm Kiri ($/hoja)",
        "patron": r"18mm MDF\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "KIRI",
    },
    {
        "campo": "priceBoard15WhiteAglo",
        "fuente": "placas",
        "descripcion": "Melamina blanca MDP 15mm — Tundra ($/hoja)",
        "patron": r"15mm Tundra Aglomerado\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "TABLEROS DE MELAMINA BLANCOS",
    },
    {
        "campo": "priceBacking3White",
        "fuente": "placas",
        "descripcion": "Fondo blanco 3mm ($/hoja)",
        "patron": r"Blanco Laca\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "FONDOS 3mm",
    },
    {
        "campo": "priceBacking55Color",
        "fuente": "placas",
        "descripcion": "Fondo texturado 5.5mm Egger G3 ($/hoja)",
        "patron": r"5,5mm MDF 1C G3\s+[\d.,]+\s+([\d.,]+)",
        "seccion": "GRUPO 3",
    },

    # ── TAPACANTOS ───────────────────────────────────────────────────────────

    {
        "campo": "priceEdge22White045",
        "fuente": "placas",
        "descripcion": "ABS 22x0,45 blanco ($/ml)",
        "patron": r"0,45x22 11474\s+([\d.,]+)",
        "seccion": "TAPACANTO PVC REHAU",
        "es_ml": True,
    },
    {
        "campo": "priceEdge45White045",
        "fuente": "placas",
        "descripcion": "ABS 45x0,45 blanco ($/ml)",
        "patron": r"0,45x45 Laca\s+([\d.,]+)",
        "seccion": "BLANCOS TEXTURADOS",
        "es_ml": True,
    },
    {
        "campo": "priceEdge22Color045",
        "fuente": "placas",
        "descripcion": "ABS 22x0,45 texturado ($/ml)",
        "patron": r"0,45x22\s+([\d.,]+)\s+[\d.,]+",
        "seccion": "LINEA METAC-NOR-NAT-BLEND-MESO",
        "es_ml": True,
    },
    {
        "campo": "priceEdge45Color045",
        "fuente": "placas",
        "descripcion": "ABS 45x0,45 texturado ($/ml)",
        "patron": r"0,45x45\s+([\d.,]+)",
        "seccion": "LINEA METAC-NOR-NAT-BLEND-MESO",
        "es_ml": True,
    },
    {
        "campo": "priceEdge2mm",
        "fuente": "placas",
        "descripcion": "PVC 2mm x22 ($/ml)",
        "patron": r"2x22 Nature / Hilado\s+([\d.,]+)",
        "seccion": "BLANCOS TEXTURADOS",
        "es_ml": True,
    },

    # ── HERRAJES ─────────────────────────────────────────────────────────────

    {
        "campo": "priceHingeStandard",
        "fuente": "herrajes",
        "descripcion": "Bisagra standard Ø35 C.0 ($/u)",
        "patron": r"Ø35 Codo 0\s+([\d.,]+)",
        "seccion": "CAZOLETA 35MM",
        # Primera aparición = Grupo Euro (la más económica)
    },
    {
        "campo": "priceHingeSoftClose",
        "fuente": "herrajes",
        "descripcion": "Bisagra cierre suave Ø35 C.0 Grupo Euro ($/u)",
        "patron": r"Ø35mm C\.0\s+([\d.,]+)",
        "seccion": "CAZOLETA CIERRE SUAVE 35MM GRUPO EURO",
    },
    {
        "campo": "priceHingePush",
        "fuente": "herrajes",
        "descripcion": "Bisagra push-on Ø35 C.0 ($/u)",
        "patron": r"Ø35 Codo 0\s+([\d.,]+)",
        "seccion": "CAZOLETA PUSH ON 35MM",
    },
    {
        "campo": "priceSlide300Std",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 300mm Grupo Euro ($/par)",
        "patron": r"300mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS GRUPO EURO",
    },
    {
        "campo": "priceSlide400Std",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 400mm Grupo Euro ($/par)",
        "patron": r"400mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS GRUPO EURO",
    },
    {
        "campo": "priceSlide500Std",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 500mm Grupo Euro ($/par)",
        "patron": r"500mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS GRUPO EURO",
    },
    {
        "campo": "priceSlide300Soft",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 300mm cierre suave ($/par)",
        "patron": r"300mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS CIERRE SUAVE GRUPO EURO",
    },
    {
        "campo": "priceSlide400Soft",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 400mm cierre suave ($/par)",
        "patron": r"400mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS CIERRE SUAVE GRUPO EURO",
    },
    {
        "campo": "priceSlide500Soft",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 500mm cierre suave ($/par)",
        "patron": r"500mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS CIERRE SUAVE GRUPO EURO",
    },
    {
        "campo": "priceSlide300Push",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 300mm push ($/par)",
        "patron": r"300mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS PUSH OPEN",
    },
    {
        "campo": "priceSlide400Push",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 400mm push ($/par)",
        "patron": r"400mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS PUSH OPEN",
    },
    {
        "campo": "priceSlide500Push",
        "fuente": "herrajes",
        "descripcion": "Guía telescópica 500mm push ($/par)",
        "patron": r"500mm\s+([\d.,]+)",
        "seccion": "TELESCOPICAS PUSH OPEN",
    },
    {
        "campo": "priceGasPiston",
        "fuente": "herrajes",
        "descripcion": "Pistón a gas 60/80/100/120N ($/u)",
        "patron": r"60/80/100/120/150N\s+([\d.,]+)",
        "seccion": "BRAZOS DE CIERRE",
    },
    {
        "campo": "priceGlueTin",
        "fuente": "placas",
        "descripcion": "Cemento contacto K-2024 2,8kg ($/u)",
        "patron": r"2,8kg\.\s+([\d.,]+)",
        "seccion": "Cemento de Contacto K-2024",
    },
    {
        "campo": "priceScrews",
        "fuente": "herrajes",
        "descripcion": "Tornillería — zincados 3.5x30 x1000u ($/millar)",
        "patron": r"3\.5X30X1000\s+([\d.,]+)",
        "seccion": "TORNILLOS ZINCADOS",
    },
]


# ── Funciones de extracción ──────────────────────────────────────────────────

def parse_precio_argentino(texto: str) -> float:
    """Convierte '14.103,39' → 14103.39"""
    texto = texto.strip()
    # Formato argentino: punto como separador de miles, coma como decimal
    texto = texto.replace(".", "").replace(",", ".")
    return float(texto)


def extraer_texto_pdf(ruta: str) -> str:
    """Extrae todo el texto del PDF como string único."""
    texto_total = []
    with pdfplumber.open(ruta) as pdf:
        for pagina in pdf.pages:
            t = pagina.extract_text()
            if t:
                texto_total.append(t)
    return fix_split_numbers("\n".join(texto_total))


def encontrar_precio_en_seccion(texto: str, seccion: str, patron: str) -> float | None:
    """
    Busca la sección en el texto y dentro de ella aplica el patrón regex.
    Devuelve el primer match como float, o None si no encuentra.
    """
    # Normalizar TODOS los espacios en blanco (incluyendo saltos de linea)
    # para que headers partidos en dos lineas ("MELAMINA\nBLANCOS") sean encontrables
    texto_norm = re.sub(r"\s+", " ", texto)

    # Buscar TODAS las ocurrencias de la seccion y probar cada una
    texto_upper = texto_norm.upper()
    seccion_upper = seccion.upper()
    pos = 0
    while True:
        idx_seccion = texto_upper.find(seccion_upper, pos)
        if idx_seccion == -1:
            return None
        bloque = texto_norm[idx_seccion : idx_seccion + 1200]
        match = re.search(patron, bloque, re.IGNORECASE | re.MULTILINE)
        if match:
            try:
                return parse_precio_argentino(match.group(1))
            except (ValueError, IndexError):
                pass
        pos = idx_seccion + 1


def aplicar_iva(precio: float) -> int:
    """Aplica IVA 21% y redondea al entero más cercano."""
    return round(precio * IVA)


# ── Lógica principal ─────────────────────────────────────────────────────────

def extraer_precios(path_placas: str, path_herrajes: str) -> dict:
    """
    Procesa ambos PDFs y devuelve el diccionario settings completo
    con todos los precios con IVA incluido.
    """
    print(f"\n📄 Leyendo PDFs...")
    print(f"   Placas:   {path_placas}")
    print(f"   Herrajes: {path_herrajes}")

    texto_placas = extraer_texto_pdf(path_placas)
    texto_herrajes = extraer_texto_pdf(path_herrajes)

    fuentes = {
        "placas": texto_placas,
        "herrajes": texto_herrajes,
    }

    resultados = {}
    errores = []

    print(f"\n🔍 Extrayendo precios...\n")
    print(f"{'Campo':<35} {'Precio s/IVA':>14} {'Precio c/IVA':>14}  {'Estado'}")
    print("─" * 80)

    for item in EXTRACTION_MAP:
        campo = item["campo"]
        fuente = item["fuente"]
        seccion = item.get("seccion", "")
        patron = item["patron"]
        descripcion = item["descripcion"]

        texto = fuentes[fuente]
        precio_raw = encontrar_precio_en_seccion(texto, seccion, patron)

        if precio_raw is None:
            errores.append(campo)
            print(f"  {'⚠️  ' + campo:<35} {'—':>14} {'—':>14}  NO ENCONTRADO")
            continue

        # Los tapacantos ($/ml) y herrajes ($/u) no tienen conversión especial
        # Todos los precios en la lista ya son el precio unitario correcto
        precio_con_iva = aplicar_iva(precio_raw)
        resultados[campo] = precio_con_iva

        precio_fmt = f"${precio_raw:>12,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        iva_fmt = f"${precio_con_iva:>12,}".replace(",", ".")
        print(f"  {'✅  ' + campo:<35} {precio_fmt:>14} {iva_fmt:>14}  {descripcion}")

    # costLaborDay no viene del PDF — lo dejamos igual al anterior
    # (se puede pasar como argumento si se quiere actualizar manualmente)
    if errores:
        print(f"\n⚠️  {len(errores)} campos no encontrados: {', '.join(errores)}")
        print("   Revisá que los PDFs sean del formato correcto.")

    return resultados, errores


def insertar_en_supabase(settings: dict, nombre_lista: str, fecha_desde: str):
    """Crea una nueva price_list en Supabase con los precios extraídos."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    if not url or not key:
        sys.exit(
            "\nERROR: Faltan variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY.\n"
            "Creá un archivo .env en esta carpeta con:\n"
            "  SUPABASE_URL=https://tu-proyecto.supabase.co\n"
            "  SUPABASE_SERVICE_KEY=tu-service-role-key\n"
        )

    supabase = create_client(url, key)

    # Obtener la lista activa más reciente
    existente = (
        supabase.table("price_lists")
        .select("settings")
        .eq("is_active", True)
        .order("valid_from", desc=True)
        .limit(1)
        .execute()
    )

    # ── Calcular máximo % de aumento entre el mes anterior y este ────────────
    # Campos manuales que no vienen del PDF — se actualizan con el max aumento
    CAMPOS_MANUALES = ["costLaborDay", "priceFinishLacquerSemi", "priceFinishLustreSemi"]
    FALLBACKS = {
        "costLaborDay":         85000,
        "priceFinishLacquerSemi": 8000,
        "priceFinishLustreSemi":  6000,
    }

    max_pct = 0.0
    prev_settings = {}

    if existente.data:
        prev_settings = existente.data[0]["settings"]
        aumentos = []
        for campo, nuevo_valor in settings.items():
            if campo in CAMPOS_MANUALES:
                continue
            prev_valor = prev_settings.get(campo)
            if prev_valor and isinstance(prev_valor, (int, float)) and prev_valor > 0:
                pct = (nuevo_valor - prev_valor) / prev_valor
                if pct > 0:
                    aumentos.append(pct)
        if aumentos:
            max_pct = max(aumentos)

    print(f"\n📈 Máximo aumento detectado en precios de PDF: {max_pct*100:.1f}%")

    # Aplicar ese aumento a los campos manuales
    for campo in CAMPOS_MANUALES:
        prev_val = prev_settings.get(campo, FALLBACKS[campo])
        nuevo_val = round(prev_val * (1 + max_pct))
        settings[campo] = nuevo_val
        prev_fmt = f"${prev_val:,}".replace(",", ".")
        nuevo_fmt = f"${nuevo_val:,}".replace(",", ".")
        print(f"   {campo:<30} {prev_fmt} → {nuevo_fmt}  (+{max_pct*100:.1f}%)")

    nueva_lista = {
        "id": str(uuid.uuid4()),
        "name": nombre_lista,
        "settings": settings,
        "valid_from": fecha_desde,
        "is_active": False,  # El usuario activa la lista manualmente desde el sistema
    }

    resultado = supabase.table("price_lists").insert(nueva_lista).execute()

    if resultado.data:
        nuevo_id = resultado.data[0]["id"]
        print(f"\n✅ Lista '{nombre_lista}' creada en Supabase con ID: {nuevo_id}")
        print(f"   valid_from: {fecha_desde}")
    else:
        print(f"\n❌ Error al insertar en Supabase: {resultado}")


# ── CLI ───────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="roden OS — Actualizador de lista de precios desde PDFs del proveedor"
    )
    parser.add_argument(
        "--placas", required=True,
        help="Ruta al PDF de Placas e Insumos"
    )
    parser.add_argument(
        "--herrajes", required=True,
        help="Ruta al PDF de Herrajes y Accesorios"
    )
    parser.add_argument(
        "--mes", required=False, default=None,
        help="Nombre de la lista (ej: 'Mayo 2026'). Si no se pasa, se detecta del nombre del PDF."
    )
    parser.add_argument(
        "--fecha", default=str(date.today()),
        help="Fecha de vigencia YYYY-MM-DD (default: hoy)"
    )
    parser.add_argument(
        "--preview", action="store_true",
        help="Solo muestra los precios extraidos, no escribe en Supabase"
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Escribe la nueva lista en Supabase"
    )
    parser.add_argument(
        "--labor-day", type=int, default=None,
        help="Costo jornal diario por operario (opcional, se calcula si no se pasa)"
    )

    args = parser.parse_args()

    # Auto-detectar mes desde el nombre del PDF si no se paso --mes
    if not args.mes:
        args.mes = detectar_mes_desde_nombre(args.placas) or detectar_mes_desde_nombre(args.herrajes)
        if args.mes:
            print(f"\nMes detectado automaticamente del nombre del archivo: '{args.mes}'")
        else:
            sys.exit(
                "ERROR: No se pudo detectar el mes desde el nombre del PDF.\n"
                "Pasa el parametro --mes manualmente (ej: --mes 'Mayo 2026')."
            )

    # Validar que existan los archivos
    for ruta, nombre in [(args.placas, "placas"), (args.herrajes, "herrajes")]:
        if not Path(ruta).exists():
            sys.exit(f"ERROR: No se encuentra el archivo de {nombre}: {ruta}")

    print(f"\n{'='*60}")
    print(f"  roden OS -- Actualizador de Lista de Precios")
    print(f"  Lista: {args.mes}  |  Vigencia: {args.fecha}")
    print(f"{'='*60}")

    settings, errores = extraer_precios(args.placas, args.herrajes)

    if args.labor_day:
        settings["costLaborDay"] = args.labor_day
        print(f"\nJornal diario actualizado manualmente: ${args.labor_day:,}".replace(",", "."))

    # Mostrar resumen final
    print(f"\n{'='*60}")
    print(f"  RESUMEN -- {len(settings)} campos extraidos, {len(errores)} no encontrados")
    print(f"{'='*60}")
    print(json.dumps(settings, indent=2, ensure_ascii=False))

    if args.preview:
        print("\n[Modo preview -- no se escribio en Supabase]")
        return

    if args.apply:
        confirmar = input(f"\nConfirmar insercion de '{args.mes}' en Supabase? [s/N]: ")
        if confirmar.lower() != "s":
            print("Cancelado.")
            return
        insertar_en_supabase(settings, args.mes, args.fecha)
    else:
        print("\nUsa --apply para escribir en Supabase, o --preview para solo ver los precios.")


if __name__ == "__main__":
    main()
