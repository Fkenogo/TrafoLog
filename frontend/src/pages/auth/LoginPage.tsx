import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Lock, Mail, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

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
        <form className="login-form" onSubmit={handleSubmit(login)}>
          <label>
            <span>Email</span>
            <div className="input-shell">
              <Mail size={17} />
              <input type="email" autoComplete="email" {...register('email')} />
            </div>
            {errors.email && <small className="field-error">{errors.email.message}</small>}
          </label>
          <label>
            <span>Password</span>
            <div className="input-shell">
              <Lock size={17} />
              <input type="password" autoComplete="current-password" {...register('password')} />
              <Eye size={17} aria-hidden="true" />
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
          </label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
