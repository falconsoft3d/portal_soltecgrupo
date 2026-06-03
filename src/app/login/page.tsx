'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiLogin } from '@/lib/api';
import {
  clearRememberedCredentials,
  getRememberedCredentials,
  getToken,
  saveRememberedCredentials,
  setToken,
} from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard');
      return;
    }

    getRememberedCredentials()
      .then((remembered) => {
        if (!remembered) return;
        setLogin(remembered.login);
        setPassword(remembered.password);
        setRememberPassword(true);
      })
      .catch(() => {
        setRememberPassword(false);
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiLogin(login.trim(), password);
      if (res.success && res.token) {
        if (rememberPassword) {
          await saveRememberedCredentials(login.trim(), password);
        } else {
          clearRememberedCredentials();
        }

        setToken(res.token);
        router.push('/dashboard');
      } else {
        setError(res.error || 'Error al iniciar sesión.');
      }
    } catch {
      setError('No se pudo conectar con el servidor. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo / Título */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800">Portal Soltec</h1>
          <p className="mt-1 text-sm text-gray-500">Ingresa con tus credenciales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-1">
              Usuario / Correo
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         transition"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         transition"
              placeholder="••••••••"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Recordar contraseña (guardada cifrada en este navegador)
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed
                       text-white font-semibold rounded-lg py-2.5 text-sm transition"
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </main>
  );
}
