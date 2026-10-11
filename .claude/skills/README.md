# Skills de Claude Code del proyecto (vendorizadas)

Estas skills viven **en el repo** a propósito: viajan por git a cualquier computadora y a
las sesiones en la nube, igual que `CLAUDE.md`. No se instalaron con `npx skills` ni como
plugin, porque se actualizarían solas sin revisión. Están **fijadas a un commit**, se
revisaron antes de copiarlas y solo cambian cuando alguien las actualiza a mano.

Claude Code las carga solo desde `.claude/skills/<nombre>/SKILL.md`.

## Origen

| Skill | Cómo se usa | Fuente | Commit | Licencia |
|---|---|---|---|---|
| `grill-with-docs` | `/grill-with-docs`, solo a mano: entrevista para alinear un cambio antes de programarlo, y va actualizando `GLOSSARY.md` y los ADR (`docs/adr/`) | mattpocock/skills `skills/engineering/grill-with-docs` | `49dd158d1076134a641b33efb035946536778336` | MIT (`LICENSE-mattpocock-skills`) |
| `grilling` | La usa `grill-with-docs` (o "grill me") | mattpocock/skills `skills/productivity/grilling` | ídem | MIT |
| `domain-modeling` | Al discutir términos del dominio o editar `GLOSSARY.md` / ADRs | mattpocock/skills `skills/engineering/domain-modeling` | ídem | MIT |
| `tdd` | Features o bugs con test primero (rojo → verde) | mattpocock/skills `skills/engineering/tdd` | ídem | MIT |
| `diagnosing-bugs` | "diagnosticá esto" / algo roto o lento | mattpocock/skills `skills/engineering/diagnosing-bugs` | ídem | MIT |
| `diagram-design` | Diagramas HTML/SVG (arquitectura, flujos, Gantt, ER, despiece explotado, axonométrico…) | cathrynlavery/diagram-design `skills/diagram-design` | `7a2e22170ee838e859d8142ba825d83f8b6375e6` | MIT (`diagram-design/LICENSE`, `THIRD_PARTY_LICENSES.md`) |

## Revisión de seguridad (2026-10-11)

- **mattpocock**: solo markdown; un script plantilla (`diagnosing-bugs/scripts/hitl-loop.template.sh`)
  que se copia y edita a mano. Sin red, sin hooks, sin MCP.
- **diagram-design**: markdown, plantillas HTML y 5 scripts Python que usan solo la librería
  estándar (sin `subprocess`, sin red). Lo único externo: los HTML generados cargan
  Google Fonts. Su `PRIVACY.md` declara cero telemetría. Sin hooks ni MCP.
- No se encontraron instrucciones de inyección (`ignore previous`, `curl | sh`, etc.).

## Cambios respecto del original

- Se quitaron los `agents/openai.yaml` (solo sirven para Codex).
- `domain-modeling/SKILL.md`: el original exige un glosario "sin ningún detalle de
  implementación". Acá el glosario **lleva** la columna "En el código" (UI en español,
  código en inglés). Adaptación marcada con "rødën (adaptación)".
- `domain-modeling/GLOSSARY-FORMAT.md`: reescrito con el formato de tablas del `GLOSSARY.md` de rødën.
- `tdd/SKILL.md`: se quitó la referencia a la skill `codebase-design` (no instalada) y se
  agregó una sección "rødën (adaptación)" (`npm test`, seam en `utils/estimatorEngine.ts`,
  regla de la foto baseline).
- `diagram-design`: sin cambios. **La primera vez** pregunta si se personaliza el estilo
  (colores y tipografía de marca); la identidad de rødën está en `roden-propuesta/` y
  `roden_propuesta_sistema.html`.

## Notas

- La skill `tdd` menciona `code-review` para la etapa de refactor: es la `/code-review`
  que ya trae Claude Code, no la de mattpocock (no se instaló).
- Para actualizar: clonar la fuente, revisar el diff contra el commit fijado de esta tabla,
  copiar, **volver a aplicar las adaptaciones** y actualizar el commit acá.
