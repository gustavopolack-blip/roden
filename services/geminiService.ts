
import { GoogleGenAI } from "@google/genai";
import { BusinessData } from '../types';

const getEnvVar = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return '';
};

const getAiInstance = () => {
  // Always use process.env.GEMINI_API_KEY for the Gemini API.
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. AI features will be simulated or fail.");
  }
  return new GoogleGenAI({ apiKey });
};

export const askRodenAI = async (
  question: string, 
  context: BusinessData
): Promise<string> => {
  try {
    const ai = getAiInstance();
    
    const contextString = JSON.stringify(context, null, 2);
    
    const systemInstruction = `
      Eres el Jefe de Operaciones IA para 'rødën', una empresa de muebles a medida de alta gama.
      Tu tono es profesional, conciso, estratégico y premium (en Español).
      
      Tienes acceso a los datos actuales del negocio en formato JSON:
      Clientes (Clients), Proyectos (Projects) y Presupuestos (Budgets).
      
      Responde la pregunta del usuario basándote estrictamente en estos datos.
      Si el usuario pregunta por ingresos (revenue), calcúlalo sumando los presupuestos con estado APPROVED.
      Si el usuario pregunta por retrasos, revisa las fechas límite (deadline) vs la fecha actual (Asume que hoy es ${new Date().toISOString().split('T')[0]}).
      
      Datos:
      ${contextString}
      
      Sé útil y proporciona insights accionables. No uses formato markdown excesivamente, manténlo limpio.
      Responde SIEMPRE en Español.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: question,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Even lower for more consistency
      }
    });

    return response.text || "No pude generar una respuesta en este momento.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Lo siento, no puedo acceder a la red de inteligencia de rødën en este momento. Por favor verifica tu API key.";
  }
};

export const generateChecklist = async (projectType: string): Promise<string[]> => {
  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
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
