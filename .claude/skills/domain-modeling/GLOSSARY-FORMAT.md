# GLOSSARY.md Format (rødën)

> Adaptado del formato original de mattpocock/skills al formato que ya usa `GLOSSARY.md`
> en la raíz de rødën OS. Si este archivo y el glosario existente difieren, manda el glosario.

## Estructura

Un solo `GLOSSARY.md` en la raíz (rødën es un único contexto). Términos agrupados por
área (flujo del negocio, presupuestos, despiece y materiales, terminaciones y herrajes,
costos, constructor 3D, roles), cada área como una tabla:

```md
## Despiece y materiales

| Término | Qué es | En el código |
|---|---|---|
| **MDP / Aglo** | Aglomerado melamínico. La UI dice "MDP"; el código dice `AGLO`: son lo mismo. | `structureCore`/`frontsCore` = `'AGLO'` |
```

Al final, una sección `## Dudas abiertas [a confirmar con el taller]` con preguntas
numeradas. Al resolver una, mover la respuesta a la tabla correspondiente y borrarla de la lista.

## Reglas

- **Ser opinado.** Si hay varias palabras para lo mismo, elegir una y nombrar las otras en
  la definición ("La UI dice X; el código dice Y").
- **Definiciones cortas.** Una o dos oraciones: qué ES, no cómo se implementa.
- **"En el código" es el puente, no la spec.** Nombre del tipo, campo, valor de enum o
  función donde vive el término. Nada de lógica.
- **Solo términos del dominio rødën.** Conceptos generales de programación no van.
- **Verificar contra el código** antes de escribir un nombre en la columna "En el código".
