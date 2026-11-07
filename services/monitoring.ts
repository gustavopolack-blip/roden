// Aviso de errores (Sentry). Solo se activa si VITE_SENTRY_DSN está configurada en Vercel: el DSN
// es público por diseño (solo permite enviar errores, no leerlos). Sin DSN no se carga nada.
// El SDK se carga aparte (import dinámico) para no sumar peso a la app cuando está apagado.
let capture: ((error: unknown, hint?: { extra: Record<string, unknown> }) => void) | null = null;

export const initMonitoring = async (): Promise<void> => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  try {
    const { init, captureException } = await import('./sentry');
    init({
      dsn,
      release: __APP_VERSION__,
      // La app de producción se sirve en rodenmobel.com/os; lo demás son vistas previas o local.
      environment: window.location.hostname.endsWith('rodenmobel.com') ? 'production' : 'preview',
    });
    capture = (error, hint) => { captureException(error, hint); };
  } catch (e) {
    console.warn('[monitoring] No se pudo iniciar Sentry:', e);
  }
};

/** Manda un error a Sentry (si está activo). `context` = datos extra para entender el caso. */
export const reportError = (error: unknown, context?: Record<string, unknown>): void => {
  capture?.(error, context ? { extra: context } : undefined);
};
