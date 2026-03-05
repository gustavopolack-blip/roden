
import { GoogleGenAI } from "@google/genai";
import { BusinessData } from '../types';

// 🛠️ Forzamos la lectura de la variable de Vite
const getApiKey = () => {
  // Primero intenta leer la de Vite (estándar) o process.env
  // @ts-ignore
  const key = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!key || key === 'undefined') {
    console.error("🚨 Error Crítico: GEMINI_API_KEY no detectada.");
    return null;
  }
  return key;
};

const apiKey = getApiKey();

// Solo inicializamos si la llave existe
export const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const runContextualAnalysis = async (
  mode: string,
  data: any
): Promise<string> => {
  if (!genAI) return "Error en la conexión con rødën AI: API Key no configurada.";
  try {
    const today = new Date().toISOString().split('T')[0];
    const dataString = JSON.stringify(data, null, 2);

    const modePrompts: Record<string, string> = {
      clientes_cartera: `
        MODE: clientes_cartera — Datos: clients[], projects[], savedEstimates[]
        Por cada cliente ACTIVE calculá valor real (estimates APPROVED/ARCHIVED), valor potencial (QUOTING), días desde último contacto. Clasificá en: ACTIVOS CON ALTO VALOR / EN NEGOCIACIÓN ESTANCADA (SENT > 15 días) / SILENCIOSOS CON POTENCIAL (sin actividad > 60 días con historial).
        ---
        ANÁLISIS DE CARTERA — ${today}
        ACTIVOS CON ALTO VALOR ([n])
        - [Cliente] — Obra: [título] — Entrega: [deadline] — Valor: $XX.XXX
        EN NEGOCIACIÓN ESTANCADA ([n])
        - [Cliente] — v[n] — Enviado hace [n] días — $XX.XXX
        SILENCIOSOS CON POTENCIAL ([n])
        - [Cliente] — Último contacto: [n] días — [n] obras — Valor acumulado: $XX.XXX
        OPORTUNIDAD DETECTADA
        [solo si hay algo concreto]
        ---
        → Para actualizar clientes, dirigite al módulo Clientes.
      `,
      proyectos_atencion: `
        MODE: proyectos_atencion — Datos: projects[], tasks[], supplierPayments[], clients[]
        Por cada proyecto en PRODUCTION: días en etapa (today - stepDates[productionStep]), días restantes (deadline - today), tareas vencidas, saldos vencidos. CRÍTICO si: diasRestantes < 7 O diasEnEtapa > 10 O tieneTareasVencidas. ATENCIÓN si: diasRestantes 7-15 O diasEnEtapa 7-10.
        ---
        ATENCIÓN OPERATIVA — ${today}
        🔴 CRÍTICO ([n])
        - [Título] ([Cliente]) — Etapa: [step] — [n] días en etapa — [n] días para entrega
          [si tareas]: ⚠ [n] tarea/s vencida/s — [assignee]
          [si pagos]: ⚠ Pago pendiente a [proveedor] $XX.XXX
        🟡 ATENCIÓN ([n])
        - [Título] — [step] — [n] días restantes
        🟢 EN CURSO ([n])
        - [Título] — [step] — [n] días restantes
        PROPUESTAS ESTANCADAS
        - [Título] — en [status] hace [n] días
        ---
        → Para actualizar etapas, dirigite a Proyectos o Taller.
      `,
      estimador_revision: `
        MODE: estimador_revision — Datos: estimate (SavedEstimate completo)
        Revisá SOLO los problemáticos: height>2700 / depth>700 en bajo mesada / width>3000 / height<200 o width<200 / LACQUER+frontsCore=AGLO / hasGasPistons sin cntFlaps / backingType=3MM_WHITE con height>2200 / priceListName null / version>3 en QUOTING / items sin modules / name vacío.
        ---
        REVISIÓN — [customProjectName] v[version]
        OBSERVACIONES ([n])
        ⚠ MÓDULO "[name]": [descripción exacta]
        ⚠ PRESUPUESTO: [descripción exacta]
        [Si nada]: "✓ Sin observaciones. El presupuesto está listo para enviar."
        ---
        → Para corregir, dirigite al Estimador de Costos.
      `,
      historial_diagnostico: `
        MODE: historial_diagnostico — Datos: estimateChain[] (versiones ASC), client
        Calculá días totales en negociación, variación de precio v1→última, cambios entre versiones. Patrones: PRECIO (subió >15%) / INDECISIÓN (>3 versiones sin cambios) / SILENCIO (SENT >20 días) / CLIENTE NUEVO (sin obras + >$500k) / MATERIAL (cambios en approvedVariants).
        ---
        DIAGNÓSTICO DE NEGOCIACIÓN — [customProjectName]
        LÍNEA DE TIEMPO
        v[n] ([fecha]) → $XX.XXX — [commercialStatus]
        [n] días en negociación total
        VARIACIÓN DE PRECIO
        Primera: $XX.XXX → Última: $XX.XXX ([+/-]XX%)
        Principal causa: [rubro]
        PATRÓN DETECTADO
        [nombre]: [descripción con datos]
        PERFIL DEL CLIENTE
        Obras completadas: [n] | Ticket promedio: $XX.XXX
        HIPÓTESIS
        [Una hipótesis concreta]
        ---
        → Para nueva versión, dirigite al Historial de Presupuestos.
      `,
      taller_checklist: `
        MODE: taller_checklist — Datos: project, estimate (phase=APPROVED), approvedVariants
        Sumar cntDoors/cntDrawers/cntFlaps totales. Identificar herrajes y materiales reales. Pasos adicionales para LACQUER (preparación, sellador, fondo, laca) y VENEER (cola, enchapado, prensado). Incluir extras[] si existen.
        ---
        CHECKLIST DE PRODUCCIÓN
        [project.title] — [approvedVariants resumido] — ${today}
        MATERIALES A CONFIRMAR
        - [materiales y cantidades]
        SECUENCIA
        [ ] [paso específico con datos reales]
        NOTAS TÉCNICAS
        [máximo 2 líneas]
        ---
        → Para registrar avance, usá el módulo Taller.
      `,
      proveedores_costos: `
        MODE: proveedores_costos — Datos: supplierPayments[], projects[], suppliers[]
        Agrupá pagos por proveedor (últimos 90 días). Por proyecto en PRODUCTION/READY: costo real vs budget. Detectá costo > 70% del budget, proveedor > 40% del costo, saldos con balanceDate < today y PENDING.
        ---
        ANÁLISIS DE COSTOS — ${today}
        RANKING DE PROVEEDORES (últimos 90 días)
        1. [Proveedor] — $XX.XXX — [n] proyectos — [categoría]
        PROYECTOS CON MARGEN COMPROMETIDO
        - [Título] — Budget: $XX.XXX — Costo: $XX.XXX — Margen restante: XX%
          ⚠ [Proveedor] representa el XX% del costo
        SALDOS VENCIDOS
        - [Proveedor] → [Proyecto] — $XX.XXX — Venció: [fecha] — [n] días de retraso
        ---
        → Para registrar pagos, dirigite a Finanzas.
      `,
      finanzas_lectura: `
        MODE: finanzas_lectura — Datos: projects[], supplierPayments[], savedEstimates[], periodo("mes"|"trimestre"|"año")
        Rango: mes=30d / trimestre=90d / año=365d desde today. Proyectos COMPLETED en período: ingresos, costos, margen. Desglosá por tipo inferido del título. Comparar primera vs segunda mitad. Generá exactamente 3 conclusiones accionables.
        ---
        LECTURA FINANCIERA — [periodo] ([rango])
        RESUMEN
        Ingresos: $XX.XXX | Costos: $XX.XXX | Margen: XX%
        Pipeline: $XX.XXX | En producción aprobado: $XX.XXX
        DESGLOSE
        [Tipo] ([n] obras): $XX.XXX — XX%
        TENDENCIA
        [Primera mitad] XX% → [Segunda mitad] XX%
        3 CONCLUSIONES
        1. [Específica con datos]
        2. [Específica con datos]
        3. [Específica con datos]
        ---
        → Para registrar datos, dirigite a Informes.
      `,
      dashboard_briefing: `
        MODE: dashboard_briefing — Datos: projects[], tasks[], supplierPayments[], savedEstimates[], clients[]
        Priorizá: 1) deadline<7d, 2) pagos vencidos, 3) presupuestos SENT>15d, 4) tareas HIGH vencidas. Máximo 10 líneas. Sin secciones extra.
        ---
        BRIEFING rødën — ${today}
        🔴 [Proyecto] — [etapa] — [n] días para entrega
        💰 Saldo vencido: [proveedor] $XX.XXX ([proyecto])
        📋 [Cliente] espera respuesta hace [n] días — $XX.XXX
        ✓ [n] tarea/s vencida/s — [assignee]
        [Si todo OK]: "✓ Sin alertas activas. [n] obras en curso."
        ---
      `
    };

    const systemInstruction = `
      Eres rødën AI, el Sistema de Inteligencia Operativa de 'rødën'.
      
      TONO Y REGLAS:
      - Español rioplatense (vos).
      - Profesional, conciso, directo. Sin relleno.
      - Números exactos. Montos en $XX.XXX (ARS).
      - Si un campo es null, escribí "sin datos". Nunca lo inventes.
      - La fecha actual es ${today}.
      - Sos un analista de solo lectura. Output: información, alertas y recomendaciones.
      - Nunca modificás datos. Nunca ejecutás acciones.
      - Cuando el análisis implique una acción, cerrás con: "→ Para implementar, dirigite a [módulo]."
      
      MISIÓN ESPECÍFICA:
      ${modePrompts[mode] || 'Analizá los datos proporcionados.'}
      
      DATOS PARA EL ANÁLISIS:
      ${dataString}
    `;

    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Ejecutá el análisis para el modo: ${mode}`,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      }
    });

    return response.text || "No pude generar el análisis en este momento.";
  } catch (error) {
    console.error("Contextual Analysis Error:", error);
    return "Error en la conexión con rødën AI. Reintentá en unos momentos.";
  }
};

export const askRodenAI = async (query: string, data: BusinessData): Promise<string> => {
  if (!genAI) return "Error en la conexión con rødën AI: API Key no configurada.";
  try {
    const today = new Date().toISOString().split('T')[0];
    const dataString = JSON.stringify(data, null, 2);

    const systemInstruction = `
      Eres rødën AI, el Sistema de Inteligencia Operativa de 'rødën'.
      
      TONO Y REGLAS:
      - Español rioplatense (vos).
      - Profesional, conciso, directo. Sin relleno.
      - Números exactos. Montos en $XX.XXX (ARS).
      - Si un campo es null, escribí "sin datos". Nunca lo inventes.
      - La fecha actual es ${today}.
      
      CONTEXTO DEL NEGOCIO:
      rødën es un taller de producción de muebles a medida de alta gama.
      Módulos: Clientes, Proyectos, Taller, Finanzas, Informes.
      
      DATOS OPERATIVOS EN TIEMPO REAL:
      ${dataString}
      
      Responde a la consulta del usuario basándote en estos datos.
    `;

    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      }
    });

    return response.text || "No pude procesar tu consulta en este momento.";
  } catch (error) {
    console.error("Roden AI Error:", error);
    return "Error en la conexión con rødën AI. Reintentá en unos momentos.";
  }
};

export const generateChecklist = async (projectType: string): Promise<string[]> => {
  if (!genAI) return ["Medición en obra", "Pedido de materiales", "Corte de placas", "Ensamblaje", "Control de Calidad"];
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Genera una lista de control de producción de alto nivel de 5 ítems para un proyecto de "${projectType}" en una carpintería de alta gama. Devuelve SOLO un array JSON de strings en Español.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Checklist Gen Error:", error);
    return ["Medición en obra", "Pedido de materiales", "Corte de placas", "Ensamblaje", "Control de Calidad"];
  }
};
