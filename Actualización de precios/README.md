# rødën OS — Actualizador de Lista de Precios

Script Python que extrae precios de los PDFs mensuales del proveedor
y crea una nueva lista en la tabla `price_lists` de Supabase.

---

## Instalación (una sola vez)

```bash
pip install pdfplumber supabase python-dotenv
```

Creá el archivo `.env` a partir del ejemplo:

```bash
cp .env.example .env
# Editá .env y completá SUPABASE_SERVICE_KEY
```

---

## Uso mensual

### 1. Ver los precios extraídos sin escribir nada (recomendado primero)

```bash
python update_prices.py \
  --placas "Lista de Precios Placas e Insumos MAYO 2026.pdf" \
  --herrajes "Lista de Precios Herrajes y Accesorios MAYO 2026.pdf" \
  --mes "Mayo 2026" \
  --preview
```

### 2. Aplicar (escribe en Supabase)

```bash
python update_prices.py \
  --placas "Lista de Precios Placas e Insumos MAYO 2026.pdf" \
  --herrajes "Lista de Precios Herrajes y Accesorios MAYO 2026.pdf" \
  --mes "Mayo 2026" \
  --apply
```

### 3. Actualizar también el jornal diario

```bash
python update_prices.py \
  --placas "..." \
  --herrajes "..." \
  --mes "Mayo 2026" \
  --labor-day 90000 \
  --apply
```

---

## Parámetros

| Parámetro | Descripción |
|---|---|
| `--placas` | Ruta al PDF de Placas e Insumos |
| `--herrajes` | Ruta al PDF de Herrajes y Accesorios |
| `--mes` | Nombre de la lista (aparece en el sistema) |
| `--fecha` | Fecha de vigencia YYYY-MM-DD (default: hoy) |
| `--preview` | Solo muestra precios, no escribe |
| `--apply` | Escribe en Supabase (pide confirmación) |
| `--labor-day` | Jornal diario en pesos (opcional) |

---

## Qué hace exactamente

1. Extrae texto de ambos PDFs usando `pdfplumber`
2. Localiza cada sección (ej: "TABLEROS DE MELAMINA BLANCOS", "TELESCOPICAS GRUPO EURO")
3. Aplica un regex específico para cada precio dentro de esa sección
4. Multiplica por **1.21** (IVA 21%) y redondea al entero
5. Construye el JSON `settings` con todos los campos de `price_lists`
6. Inserta una nueva fila en Supabase (no modifica listas anteriores)

---

## Campos que extrae

| Campo Supabase | Producto |
|---|---|
| `priceBoard18WhiteAglo` | Melamina blanca MDP 18mm ($/hoja) |
| `priceBoard18WhiteMDF` | Melamina blanca MDF 18mm ($/hoja) |
| `priceBoard18ColorAglo` | Melamina color MDP 18mm Blend ($/hoja) |
| `priceBoard18ColorMDF` | Melamina texturada MDF 18mm Egger G6 ($/hoja) |
| `priceBoard18MDFCrudo1Face` | MDF crudo 18mm Trupan ($/hoja) |
| `priceBoard18VeneerMDF` | Enchapado MDF 18mm Kiri ($/hoja) |
| `priceBoard15WhiteAglo` | Melamina blanca MDP 15mm ($/hoja) |
| `priceBacking3White` | Fondo blanco 3mm ($/hoja) |
| `priceBacking55Color` | Fondo texturado 5.5mm Egger G3 ($/hoja) |
| `priceEdge22White045` | ABS 22x0.45 blanco ($/ml) |
| `priceEdge45White045` | ABS 45x0.45 blanco ($/ml) |
| `priceEdge22Color045` | ABS 22x0.45 texturado ($/ml) |
| `priceEdge45Color045` | ABS 45x0.45 texturado ($/ml) |
| `priceEdge2mm` | PVC 2mm x22 ($/ml) |
| `priceHingeStandard` | Bisagra standard Ø35 ($/u) |
| `priceHingeSoftClose` | Bisagra cierre suave Ø35 ($/u) |
| `priceHingePush` | Bisagra push-on Ø35 ($/u) |
| `priceSlide300Std` | Guía telescópica 300mm std ($/par) |
| `priceSlide400Std` | Guía telescópica 400mm std ($/par) |
| `priceSlide500Std` | Guía telescópica 500mm std ($/par) |
| `priceSlide300Soft` | Guía telescópica 300mm cierre suave ($/par) |
| `priceSlide400Soft` | Guía telescópica 400mm cierre suave ($/par) |
| `priceSlide500Soft` | Guía telescópica 500mm cierre suave ($/par) |
| `priceSlide300Push` | Guía telescópica 300mm push ($/par) |
| `priceSlide400Push` | Guía telescópica 400mm push ($/par) |
| `priceSlide500Push` | Guía telescópica 500mm push ($/par) |
| `priceGasPiston` | Pistón a gas ($/u) |
| `priceGlueTin` | Cemento contacto K-2024 2.8kg ($/u) |
| `priceScrews` | Tornillería x1000u ($/millar) |
| `costLaborDay` | Jornal diario operario (conservado del mes anterior) |

---

## Si un campo aparece como "NO ENCONTRADO"

El proveedor puede haber cambiado el formato del PDF. En ese caso:
1. Corré `--preview` para ver qué se encontró y qué no
2. Abrí `update_prices.py` y buscá el campo en `EXTRACTION_MAP`
3. Ajustá el `patron` o la `seccion` para que matchee la nueva estructura
4. Volvé a correr

---

## Notas

- El script **siempre crea una nueva lista**, nunca modifica las anteriores
- `costLaborDay` no está en los PDFs — se conserva del mes anterior automáticamente
- Todos los precios se guardan **con IVA incluido** (×1.21)
- Compatible con Python 3.10+
