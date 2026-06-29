import re
import pdfplumber

def fix_split_numbers(text):
    text = re.sub(r'\b(\d{1,2}) (\d{1,2}\.\d{3},\d{2})\b', lambda m: m.group(1)+m.group(2), text)
    text = re.sub(r'\b(\d) \.(\d{3},\d{2})\b', r'\1.\2', text)
    text = re.sub(r'\b(\d) (\d{2},\d{2})\b', r'\1\2', text)
    return text

def extraer_texto(ruta):
    textos = []
    with pdfplumber.open(ruta) as pdf:
        for p in pdf.pages:
            t = p.extract_text()
            if t:
                textos.append(t)
    raw = "\n".join(textos)
    fixed = fix_split_numbers(raw)
    return re.sub(r"\s+", " ", fixed)

placas = "Lista de Precios Placas e Insumos MAYO 2026.pdf"

print("=== BUSCANDO: TABLERO MDF TRUPAN (en placas) ===")
texto = extraer_texto(placas)
idx = texto.upper().find("TABLERO MDF TRUPAN")
if idx == -1:
    print("  *** NO ENCONTRADO — buscando variantes...")
    for keyword in ["MDF TRUPAN", "TRUPAN", "MDF CRUDO", "TABLERO MDF"]:
        i = texto.upper().find(keyword.upper())
        if i != -1:
            print(f"  VARIANTE '{keyword}' en pos {i}:")
            print(f"  >>> {texto[i:i+400]}")
            print()
else:
    print(f"  Encontrado en pos {idx}:")
    print(f"  >>> {texto[idx:idx+400]}")

print()
print("=== BUSCANDO: LINEA METAC (en placas) ===")
idx2 = texto.upper().find("LINEA METAC")
if idx2 == -1:
    print("  *** NO ENCONTRADO — buscando variantes...")
    for keyword in ["METAC", "0,45X45", "NOR-NAT", "BLEND-MESO"]:
        i = texto.upper().find(keyword.upper())
        if i != -1:
            print(f"  VARIANTE '{keyword}' en pos {i}:")
            print(f"  >>> {texto[i:i+400]}")
            print()
else:
    print(f"  Encontrado en pos {idx2}:")
    print(f"  >>> {texto[idx2:idx2+500]}")
