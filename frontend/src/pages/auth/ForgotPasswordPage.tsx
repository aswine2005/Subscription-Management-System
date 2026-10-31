import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import apiClient from '../../api/client';
export const ForgotPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await apiClient.post(
        token ? '/auth/reset-password' : '/auth/forgot-password',
        token ? { token, new_password: password } : { email },
      );
      setMessage(data.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell>
      <div className="eyebrow mb-4">Let's get you back in</div>
      <h1>{token ? 'A fresh start.' : 'Forgot your password?'}</h1>
      <p className="subtle mt-3 mb-7">
        {token
          ? 'Choose a new password. This link can be used only once.'
          : 'Enter your registered email to request a reset link.'}
      </p>
      {message ? (
        <p role="status" className="bg-[#edf3e4] text-[#637d49] rounded-lg p-4 text-sm leading-7">
          {message}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {token ? (
            <Input
              label="New password"
              type="password"
              required
              minLength={9}
              maxLength={72}
              autoComplete="new-password"
              helperText="More than 8 characters, uppercase, lowercase, and a special character."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : (
            <Input
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}{' '}
          {error && (
            <p role="alert" className="text-xs text-rose-600">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={busy}>
            {token ? 'Reset password' : 'Send reset link'}
          </Button>
        </form>
      )}
      <Link to="/login" className="inline-block text-[11px] text-indigo-600 mt-7">
        ← Back to sign in
      </Link>
    </AuthShell>
  );
};
