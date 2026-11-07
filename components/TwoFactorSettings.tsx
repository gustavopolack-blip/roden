/**
 * Configuración → Seguridad: activar o desactivar la verificación en dos pasos (código TOTP de una
 * app como Google Authenticator). Una vez activada, la base exige el código para entregar datos
 * (migration_mfa_enforcement.sql) y al ingresar se pide en MfaScreen.
 */
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

type Enrolling = { factorId: string; qr: string; secret: string };

const TwoFactorSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const refresh = async () => {
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) setError(e.message);
    setActiveFactorId(data?.totp.find(f => f.status === 'verified')?.id ?? null);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      // Un intento anterior que no se terminó deja un factor sin verificar: se borra antes.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'rødën OS' });
      if (e) throw e;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err: any) {
      setError(err?.message || 'No se pudo iniciar la activación.');
    } finally { setBusy(false); }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolling) return;
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: code.trim() });
      if (err) throw err;
      setEnrolling(null); setCode('');
      await refresh();
    } catch (err: any) {
      setError(/invalid|expired/i.test(err?.message || '') ? 'Código incorrecto o vencido. Probá con el que muestra ahora la app.' : (err?.message || 'No se pudo verificar.'));
    } finally { setBusy(false); }
  };

  const disable = async () => {
    if (!activeFactorId) return;
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId: activeFactorId });
      if (err) throw err;
      setConfirmOff(false);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'No se pudo desactivar.');
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-fade-in space-y-4">
      <div>
        <h3 className="text-lg font-bold text-roden-black">Verificación en dos pasos</h3>
        <p className="text-sm text-gray-500 mt-1">
          Además de la contraseña, al ingresar se pide un código de 6 dígitos que genera una app en tu celular
          (Google Authenticator, Microsoft Authenticator o similar). Si alguien obtiene tu contraseña, sin el
          celular no puede ver ni tocar los datos.
        </p>
      </div>

      {loading ? <Loader2 className="animate-spin text-gray-400" size={20} /> : activeFactorId ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><ShieldCheck size={18} /> Activada</p>
          {!confirmOff ? (
            <button onClick={() => setConfirmOff(true)} className="text-xs text-red-600 hover:underline">Desactivar</button>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600">¿Desactivar? Vas a ingresar solo con la contraseña.</span>
              <button onClick={disable} disabled={busy} className="px-3 py-1 rounded bg-red-600 text-white font-bold disabled:opacity-50">Sí, desactivar</button>
              <button onClick={() => setConfirmOff(false)} className="px-3 py-1 rounded border border-gray-200">Cancelar</button>
            </div>
          )}
        </div>
      ) : enrolling ? (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm text-gray-700">1. Escaneá este código con la app de autenticación del celular:</p>
          <img src={enrolling.qr} alt="Código QR para la app de autenticación" className="w-48 h-48 border border-gray-200 rounded" />
          <p className="text-xs text-gray-500">¿No podés escanear? Cargá esta clave a mano: <span className="font-mono select-all text-gray-800">{enrolling.secret}</span></p>
          <p className="text-sm text-gray-700">2. Escribí el código de 6 dígitos que muestra la app:</p>
          <div className="flex items-center gap-2">
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
              className="w-36 border border-gray-200 p-2 rounded font-mono text-lg tracking-widest text-center" />
            <button type="submit" disabled={busy || code.length !== 6}
              className="px-4 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50">Activar</button>
            <button type="button" onClick={() => { setEnrolling(null); setCode(''); }} className="text-xs text-gray-500 hover:underline">Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-gray-600"><ShieldOff size={18} /> Desactivada</p>
          <button onClick={start} disabled={busy} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50">Activar verificación en dos pasos</button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-gray-400">Si perdés el celular: en Supabase → Authentication → Users → tu usuario, borrá el factor MFA y volvé a activarlo acá.</p>
    </div>
  );
};

export default TwoFactorSettings;
