'use client';

import { useState } from 'react';
import { apiChangePassword } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function ChangePasswordForm() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const token = getToken() || '';
      const res = await apiChangePassword(
        token,
        form.current_password,
        form.new_password,
        form.confirm_password,
      );

      if (res.success) {
        setStatus({ type: 'success', msg: res.message || 'Contraseña actualizada.' });
        setForm({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        setStatus({ type: 'error', msg: res.error || 'Error al cambiar la contraseña.' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'No se pudo conectar con el servidor.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {[
        { name: 'current_password', label: 'Contraseña actual' },
        { name: 'new_password', label: 'Nueva contraseña' },
        { name: 'confirm_password', label: 'Confirmar nueva contraseña' },
      ].map(({ name, label }) => (
        <div key={name}>
          <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <input
            id={name}
            name={name}
            type="password"
            required
            value={form[name as keyof typeof form]}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                       transition"
            placeholder="••••••••"
          />
        </div>
      ))}

      {status && (
        <p
          className={`text-sm px-3 py-2 rounded-lg border ${
            status.type === 'success'
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-red-600 bg-red-50 border-red-200'
          }`}
        >
          {status.msg}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed
                   text-white font-semibold rounded-lg py-2.5 text-sm transition"
      >
        {loading ? 'Guardando...' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
