import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check } from 'lucide-react';
import { registerSchema, RegisterFormData } from '../../utils/validators';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthShell } from './AuthShell';
export const RegisterPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });
  const password = watch('password') || '';
  const submit = async (d: RegisterFormData) => {
    setBusy(true);
    setError('');
    try {
      await auth.register(d.name, d.email, d.password);
      navigate('/portal');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell>
      <div className="eyebrow mb-4">Your next chapter starts here</div>
      <h1>A place for your business.</h1>
      <p className="subtle mt-3 mb-7">
        Create your customer account to manage subscriptions and invoices.
      </p>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <Input
          label="Full name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400">
          {[
            [password.length > 8, 'More than 8 characters'],
            [/[A-Z]/.test(password), 'Uppercase letter'],
            [/[a-z]/.test(password), 'Lowercase letter'],
            [/[^a-zA-Z0-9\s]/.test(password), 'Special character'],
          ].map(([yes, label]) => (
            <span
              key={String(label)}
              className={`flex gap-1.5 items-center ${yes ? 'text-[#6b834d]' : ''}`}
            >
              <Check size={10} />
              {label}
            </span>
          ))}
        </div>
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          isLoading={busy}
          rightIcon={<ArrowRight size={13} />}
        >
          Create customer account
        </Button>
      </form>
      <p className="text-[11px] text-slate-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
};
