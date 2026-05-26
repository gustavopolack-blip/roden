
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Lock, ArrowRight, ShieldCheck, AlertTriangle, Fingerprint } from 'lucide-react';
import {
  isBiometricAvailable,
  hasBiometricCredential,
  getBiometricEmail,
  authenticateWithBiometric,
  updateBiometricToken,
  removeBiometricCredential,
} from '../utils/webauthn';

const Login: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [message, setMessage]   = useState<string | null>(null);

  // Biometric state
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const autoTriggeredRef = useRef(false);

  // Check biometric availability on mount
  useEffect(() => {
    const check = async () => {
      const available  = await isBiometricAvailable();
      const credential = hasBiometricCredential();
      if (available && credential) {
        setBiometricReady(true);
        setBiometricEmail(getBiometricEmail());
      }
    };
    check();
  }, []);

  // ── Auto-trigger biometric when credential is ready ─────────────────────────
  // On mobile, once the credential check resolves, trigger the native prompt
  // automatically so the user never has to tap anything.
  useEffect(() => {
    if (biometricReady && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      // Small delay so the browser fully renders before showing the system dialog
      setTimeout(() => handleBiometricLogin(), 350);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricReady]);

  // ── Password login ──────────────────────────────────────────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log('Login exitoso:', data);
    } catch (err: any) {
      let msg = err.message || 'Error desconocido';
      if (msg.includes('Invalid login credentials'))
        msg = 'Usuario o contraseña incorrectos.';
      else if (msg.includes('Email not confirmed'))
        msg = 'Tu correo no ha sido confirmado. Revisa tu inbox o el panel de Supabase.';
      else if (msg.includes('Failed to fetch'))
        msg = 'Error de conexión. Verificá tu internet o si el proyecto de Supabase está activo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Biometric login ─────────────────────────────────────────────────────────
  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError(null);
    try {
      const credential = await authenticateWithBiometric();
      if (!credential) {
        setError('No se pudo verificar la huella. Intentá con usuario y contraseña.');
        return;
      }

      // Restore Supabase session using the stored refresh token
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: credential.refreshToken,
      });

      if (error || !data.session) {
        // Token expired — remove stored credential and prompt password
        removeBiometricCredential();
        setBiometricReady(false);
        setError('La sesión expiró. Por favor ingresá con tu contraseña para renovar la huella.');
        return;
      }

      // Supabase rotates refresh tokens on each use — store the new one immediately
      if (data.session.refresh_token) {
        updateBiometricToken(data.session.refresh_token);
      }

      // Session restored — App.tsx onAuthStateChange fires automatically
    } catch (err: any) {
      setError('Error al autenticar con huella. Intentá de nuevo.');
    } finally {
      setBiometricLoading(false);
    }
  };

  // ── Full-screen biometric verification overlay ──────────────────────────────
  // Shown while the native prompt is active (auto-triggered or manual)
  if (biometricLoading) {
    return (
      <div className="min-h-screen bg-roden-black flex flex-col items-center justify-center gap-6 p-8">
        <div className="relative">
          <Fingerprint size={88} className="text-white" strokeWidth={0.8} />
          <div className="absolute inset-0 rounded-full animate-ping bg-white opacity-10" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg tracking-wide">Verificando identidad</p>
          <p className="text-gray-400 text-sm mt-1">Usá tu huella o Face ID para ingresar</p>
        </div>
        <Loader2 size={20} className="text-gray-500 animate-spin mt-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center justify-center p-4 font-sans text-roden-black">

      <div className="w-full max-w-md bg-white border border-gray-200 shadow-2xl rounded-2xl overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="bg-roden-black p-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tighter mb-1">rødën</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Sistema Operativo v2.1</p>
        </div>

        <div className="p-8 pt-10">
          <h2 className="text-xl font-bold text-center mb-6">Iniciar Sesión</h2>

          {error && (
            <div className="mb-6 p-3 border text-xs font-bold rounded-lg flex items-start gap-2 bg-red-50 border-red-100 text-red-600">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-6 p-3 border text-xs font-bold rounded-lg flex items-start gap-2 bg-green-50 border-green-100 text-green-700">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* ── Biometric quick-login (manual fallback after auto-trigger fails) ─ */}
          {biometricReady && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="w-full flex flex-col items-center justify-center gap-2 py-5 bg-roden-black text-white rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg"
              >
                <Fingerprint size={36} strokeWidth={1.5} />
                <span className="text-sm font-bold tracking-wide">Ingresar con huella</span>
                {biometricEmail && (
                  <span className="text-[11px] text-gray-400 font-normal">{biometricEmail}</span>
                )}
              </button>

              <div className="flex items-center gap-3 mt-5 mb-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] text-gray-400 font-medium uppercase tracking-widest">o</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </div>
          )}

          {/* ── Email + Password form ─────────────────────────────── */}
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1 ml-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm font-medium"
                placeholder="usuario@roden.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1 ml-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm font-medium"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-800 text-white font-bold py-3.5 rounded-xl hover:bg-gray-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : <><ArrowRight size={18} /> Ingresar con contraseña</>
              }
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
          <p className="text-[10px] text-gray-400">
            Acceso restringido a personal autorizado de rødën.<br />
            Si olvidaste tu contraseña contacta al administrador.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
