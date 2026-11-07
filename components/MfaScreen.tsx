/**
 * Verificación en dos pasos al ingresar: aparece después de la contraseña cuando el usuario tiene
 * activado el código de 6 dígitos (Configuración → Seguridad). Hasta verificarlo, la base no
 * entrega datos (migration_mfa_enforcement.sql).
 */
import React, { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface MfaScreenProps {
  onVerified: () => void;
  onLogout: () => void;
}

const MfaScreen: React.FC<MfaScreenProps> = ({ onVerified, onLogout }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = factors.totp.find(f => f.status === 'verified');
      if (!factor) throw new Error('No hay un código de verificación activo para este usuario.');
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
      if (verifyError) throw verifyError;
      onVerified();
    } catch (err: any) {
      setError(/invalid|expired/i.test(err?.message || '') ? 'Código incorrecto o vencido. Probá con el que muestra ahora la app.' : (err?.message || 'No se pudo verificar.'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-roden-black flex flex-col items-center justify-center gap-6 p-8">
      <ShieldCheck size={72} strokeWidth={1} className={error ? 'text-red-400' : 'text-white'} />
      <div className="text-center">
        <p className="text-white font-bold text-xl tracking-wide">rødën</p>
        <p className="text-gray-400 text-sm mt-1">Ingresá el código de 6 dígitos de tu app de autenticación</p>
      </div>
      <form onSubmit={verify} className="flex flex-col items-center gap-3 w-full max-w-xs">
        <input
          autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 rounded-xl bg-white text-roden-black outline-none"
          placeholder="000000"
        />
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button type="submit" disabled={loading || code.length !== 6}
          className="w-full py-3.5 bg-white text-roden-black font-bold rounded-xl hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Verificar'}
        </button>
        <button type="button" onClick={onLogout} className="text-[11px] text-gray-500 hover:text-gray-300 mt-1 underline">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
};

export default MfaScreen;
