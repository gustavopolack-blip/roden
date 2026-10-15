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
| `web-design-guidelines` | `/web-design-guidelines <archivo>`: revisa UI (accesibilidad, foco, formularios, formatos `es-AR`, acciones destructivas) y devuelve hallazgos `archivo:línea`. Solo revisa, no corrige | vercel-labs/web-interface-guidelines `command.md` (el `SKILL.md` de vercel-labs/agent-skills solo lo descarga) | `434b7f91364665f2f733b310ec54809bf8f37937` | MIT (`web-design-guidelines/LICENSE`) |

## Revisión de seguridad (2026-10-11)

- **mattpocock**: solo markdown; un script plantilla (`diagnosing-bugs/scripts/hitl-loop.template.sh`)
  que se copia y edita a mano. Sin red, sin hooks, sin MCP.
- **diagram-design**: markdown, plantillas HTML y 5 scripts Python que usan solo la librería
  estándar (sin `subprocess`, sin red). Lo único externo: los HTML generados cargan
  Google Fonts. Su `PRIVACY.md` declara cero telemetría. Sin hooks ni MCP.
- **web-design-guidelines** (2026-10-15): solo markdown, sin scripts, hooks ni MCP.
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

- `web-design-guidelines`: el `SKILL.md` original de vercel-labs/agent-skills manda a bajar las
  reglas de la rama `main` en cada uso (instrucciones remotas sin revisar, que pueden cambiar en
  cualquier momento). Se reemplazó: las reglas de `command.md` están copiadas textualmente dentro
  del `SKILL.md`, fijadas al commit de la tabla. Se agregó una sección "rødën (adaptación)": qué
  reglas no aplican (SSR/hidratación, Title Case en inglés, detección de idioma) y cuáles pesan más
  (formatos `es-AR`, no más `alert()`/`confirm()`), y que la skill solo revisa, no corrige en masa.

## Evaluadas y no incorporadas (2026-10-15)

Las recomendaba un video de TikTok (Revolutia.ai) sobre "skills de diseño para Claude Code".

| Candidata | Por qué no |
|---|---|
| `Leonxlnx/taste-skill` | Su propia descripción dice "Not for dashboards or app screens": es para landings y webs de marketing. rødën OS es una app interna. Además ejecuta scripts Node con Chrome y busca imágenes en internet. Si sirve, sería para `roden-web` (rodenmobel.com), no para este repo. |
| `VoltAgent/awesome-design-md` | Es un catálogo de `DESIGN.md` que copian la identidad de *otras* marcas (Stripe, Supabase, Tesla…). Ponerle a rødën el sistema visual de otra empresa es lo contrario de lo que hace falta. Lo útil es el formato: escribir el `DESIGN.md` propio de rødën a partir de los estilos que ya usa la app. |
| `microsoft/playwright-cli` | Se instala globalmente con `npm install -g @playwright/cli@latest` (sin versión fija) y, para ver algo en la app, Claude necesitaría credenciales reales de Supabase. Claude Code ya trae `/run` y el entorno en la nube ya tiene Chromium + Playwright. Reevaluar si se arma un usuario de prueba y un Supabase de staging. |
| "Image To Code" | El video no muestra el repo (probablemente `abi/screenshot-to-code`). No es una skill: es una app aparte con backend y API keys propias. Claude ya lee capturas de pantalla directamente. |

## Notas

- La skill `tdd` menciona `code-review` para la etapa de refactor: es la `/code-review`
  que ya trae Claude Code, no la de mattpocock (no se instaló).
- Para actualizar: clonar la fuente, revisar el diff contra el commit fijado de esta tabla,
  copiar, **volver a aplicar las adaptaciones** y actualizar el commit acá.
