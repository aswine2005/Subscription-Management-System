import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, Sparkles, ArrowRight, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { loginSchema, LoginFormData } from '../../utils/validators';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: localStorage.getItem('brightloop_remember_email') || 'admin@brightloop.io',
      password: 'password123',
      rememberMe: !!localStorage.getItem('brightloop_remember_email'),
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const response = await login(data.email, data.password, data.rememberMe);
      showToast.success(`Welcome back, ${response.user.name}!`);

      if (response.user.role === 'customer') {
        navigate('/portal');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      showToast.error(err?.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = (email: string) => {
    setValue('email', email);
    setValue('password', 'password123');
    handleSubmit(onSubmit)();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sign in to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">BrightLoop</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Next-generation Subscription Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@domain.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                  {...register('rememberMe')}
                />
                <span>Remember me</span>
              </label>

              <Link
                to="/forgot-password"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Logins for hackathon judges */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 text-center mb-3">
              Instant Demo Access
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@brightloop.io')}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-950/60 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white transition-all text-center"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-400 mb-1" />
                <span className="text-xs font-bold">Admin</span>
                <span className="text-[9px] text-slate-400">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('staff@brightloop.io')}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-purple-950/60 border border-slate-700 hover:border-purple-500 text-slate-300 hover:text-white transition-all text-center"
              >
                <Users className="w-4 h-4 text-purple-400 mb-1" />
                <span className="text-xs font-bold">Staff</span>
                <span className="text-[9px] text-slate-400">Operations</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('customer@acme.com')}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-emerald-950/60 border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-white transition-all text-center"
              >
                <UserCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-xs font-bold">Customer</span>
                <span className="text-[9px] text-slate-400">Portal View</span>
              </button>
            </div>
          </div>

          {/* Register Link */}
          <p className="mt-6 text-center text-xs text-slate-400">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
