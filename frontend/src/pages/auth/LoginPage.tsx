import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ShieldCheck, Users, UserRound, Eye, EyeOff } from 'lucide-react';
import { loginSchema, LoginFormData } from '../../utils/validators';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthShell } from './AuthShell';
export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: localStorage.getItem('brightloop_remember_email') || '',
      rememberMe: false,
    },
  });
  const signIn = async (email: string, password: string, label: string, rememberMe = false) => {
    setBusy(label);
    setError('');
    try {
      const d = await login(email, password, rememberMe);
      navigate(d.user.role === 'customer' ? '/portal' : '/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };
  const demos = [
    {
      name: 'Admin',
      description: 'The complete workspace',
      email: 'admin@brightloop.dev',
      password: 'Admin@123',
      icon: ShieldCheck,
    },
    {
      name: 'Staff',
      description: 'Day-to-day operations',
      email: 'sarah.staff@brightloop.dev',
      password: 'Staff@123',
      icon: Users,
    },
    {
      name: 'Customer',
      description: 'Your own subscriptions & invoices',
      email: 'liam.vance@apexglobalsaas.com',
      password: 'Customer@123',
      icon: UserRound,
    },
  ];
  return (
    <AuthShell>
      <div className="eyebrow mb-4">Welcome to Brightloop</div>
      <h1>Good to see you again.</h1>
      <p className="subtle mt-3 mb-8">Sign in. Pick up where your business left off.</p>
      <form
        onSubmit={handleSubmit((d) => signIn(d.email, d.password, 'login', d.rememberMe))}
        className="space-y-5"
      >
        <Input
          label="Email address"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          rightIcon={
            <button
              type="button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          }
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-between items-center text-[10px]">
          <label className="flex items-center gap-2 text-slate-500">
            <input
              type="checkbox"
              className="accent-[#b45335] !min-h-0"
              {...register('rememberMe')}
            />
            Remember my email
          </label>
          <Link to="/forgot-password" className="text-indigo-600">
            Forgot password?
          </Link>
        </div>
        {error && (
          <p role="alert" className="text-xs text-rose-600 bg-rose-50 rounded-md p-3">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full !py-3"
          isLoading={busy === 'login'}
          disabled={!!busy}
          rightIcon={<ArrowRight size={13} />}
        >
          Sign in to your workspace
        </Button>
      </form>
      <div className="flex items-center gap-3 my-7">
        <div className="h-px bg-slate-200 flex-1" />
        <span className="text-[9px] uppercase tracking-widest text-slate-400">
          Explore the local demo
        </span>
        <div className="h-px bg-slate-200 flex-1" />
      </div>
      <div className="space-y-2">
        {demos.map((d) => (
          <button
            type="button"
            key={d.name}
            disabled={!!busy}
            className="demo-role disabled:opacity-50"
            onClick={() => signIn(d.email, d.password, d.name)}
          >
            <d.icon size={16} strokeWidth={1.4} className="text-[#81916b]" />
            <span className="flex-1">
              <strong className="font-medium text-slate-700">{d.name}</strong>
              <span className="block text-[9px] text-slate-400 mt-1">
                {busy === d.name ? 'Connecting to local database…' : d.description}
              </span>
            </span>
            <ArrowRight size={12} className="text-slate-400" />
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 mt-4 leading-5">
        Demo accounts sign in through the real API. All changes are saved to the local database.
      </p>
      <p className="text-[11px] text-slate-500 mt-7">
        New here?{' '}
        <Link to="/register" className="text-indigo-600 font-medium">
          Create a customer account <span aria-hidden="true">↗</span>
        </Link>
      </p>
    </AuthShell>
  );
};
