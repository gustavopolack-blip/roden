// Parte de Sentry que se carga aparte (ver monitoring.ts). Import estático con nombres, para que
// el bundle lleve solo init y captureException y no el SDK entero.
export { init, captureException } from '@sentry/react';
