import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { Toaster } from './components/ui/Toast';

// Layouts
import { Layout } from './components/layout/Layout';
import { CustomerLayout } from './components/layout/CustomerLayout';

// Auth Pages
const LoginPage = lazy(() =>
  import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);

// Admin / Staff Pages
import { showToast } from './components/ui/Toast';
const RecoveryPage = lazy(() =>
  import('./pages/recovery/RecoveryPage').then((m) => ({ default: m.RecoveryPage })),
);
const BillingPage = lazy(() =>
  import('./pages/billing/BillingPage').then((m) => ({ default: m.BillingPage })),
);
const TaxesPage = lazy(() =>
  import('./pages/settings/TaxesPage').then((m) => ({ default: m.TaxesPage })),
);
const TemplatesPage = lazy(() =>
  import('./pages/settings/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ProductsPage = lazy(() =>
  import('./pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const PlansPage = lazy(() =>
  import('./pages/plans/PlansPage').then((m) => ({ default: m.PlansPage })),
);
const SubscriptionsPage = lazy(() =>
  import('./pages/subscriptions/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage })),
);
const SubscriptionDetailPage = lazy(() =>
  import('./pages/subscriptions/SubscriptionDetailPage').then((m) => ({
    default: m.SubscriptionDetailPage,
  })),
);
const InvoicesPage = lazy(() =>
  import('./pages/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
);
const InvoiceDetailPage = lazy(() =>
  import('./pages/invoices/InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage })),
);
const PaymentsPage = lazy(() =>
  import('./pages/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })),
);
const DiscountsPage = lazy(() =>
  import('./pages/discounts/DiscountsPage').then((m) => ({ default: m.DiscountsPage })),
);
const UsersPage = lazy(() =>
  import('./pages/users/UsersPage').then((m) => ({ default: m.UsersPage })),
);

// Customer Pages
const CustomerDashboard = lazy(() =>
  import('./pages/customer/CustomerDashboard').then((m) => ({ default: m.CustomerDashboard })),
);
const CustomerSubscriptions = lazy(() =>
  import('./pages/customer/CustomerSubscriptions').then((m) => ({
    default: m.CustomerSubscriptions,
  })),
);
const CustomerInvoices = lazy(() =>
  import('./pages/customer/CustomerInvoices').then((m) => ({ default: m.CustomerInvoices })),
);

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => showToast.error(e.message) }),
  mutationCache: new MutationCache({
    onError: (e, _v, _c, m) => {
      if (!m.options.onError) showToast.error(e.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 1000 * 20, // Keep financial data fresh.
    },
  },
});

// Protected Route Guard
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'staff' | 'customer')[];
}> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'customer') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route Guard (redirects already logged in users)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && user) {
    if (user.role === 'customer') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Root redirect */}
      <Route
        path="/"
        element={
          isAuthenticated && user ? (
            user.role === 'customer' ? (
              <Navigate to="/portal" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="/reset-password" element={<ForgotPasswordPage />} />
      {/* Auth Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />

      {/* Admin / Staff Protected Console */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/recovery" element={<RecoveryPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route
          path="/taxes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <TaxesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plans"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PlansPage />
            </ProtectedRoute>
          }
        />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route
          path="/discounts"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DiscountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Customer Portal Protected Routes */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CustomerDashboard />} />
        <Route path="subscriptions" element={<CustomerSubscriptions />} />
        <Route path="invoices" element={<CustomerInvoices />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
      </Route>

      {/* Fallback 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                  Opening your workspace…
                </div>
              }
            >
              <AppRoutes />
            </Suspense>
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
