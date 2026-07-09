import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { AlertCircle, Eye, Loader2, Lock, Mail, Zap } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { Loading } from '../../components/common/Loading';
import { useAuth } from '../../hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

type LoginFormValues = z.infer<typeof loginSchema>;

const getLoginErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Email or password is incorrect.';
    if (error.response?.status && error.response.status >= 500) return 'Sign in is temporarily unavailable. Please try again.';
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
  }
  return 'Sign in failed. Check your details and try again.';
};

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoginError(null);
    try {
      await login(values);
    } catch (error) {
      setLoginError(getLoginErrorMessage(error));
    }
  };

  if (isLoading) return <Loading label="Restoring secure session" variant="auth" />;
  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="brand-mark large">kV</div>
          <div>
            <span>kVAssetTracker</span>
            <strong>Grid asset operations</strong>
          </div>
        </div>
        <div className="login-copy">
          <Zap size={22} />
          <h1 id="login-title">Sign in</h1>
          <p>Access transformer registry, field inspections, faults, and maintenance operations.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {loginError && (
            <div className="form-alert" role="alert">
              <AlertCircle size={17} />
              <span>{loginError}</span>
            </div>
          )}
          <label>
            <span>Email</span>
            <div className="input-shell">
              <Mail size={17} />
              <input
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                disabled={isSubmitting}
                {...register('email', {
                  onChange: () => {
                    setLoginError(null);
                    clearErrors('email');
                  }
                })}
              />
            </div>
            {errors.email && <small className="field-error">{errors.email.message}</small>}
          </label>
          <label>
            <span>Password</span>
            <div className="input-shell">
              <Lock size={17} />
              <input
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                disabled={isSubmitting}
                {...register('password', {
                  onChange: () => {
                    setLoginError(null);
                    clearErrors('password');
                  }
                })}
              />
              <Eye size={17} aria-hidden="true" />
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
          </label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="spin" size={17} aria-hidden="true" />}
            <span>{isSubmitting ? 'Signing in' : 'Sign in'}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
