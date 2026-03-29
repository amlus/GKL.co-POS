import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { LogIn } from 'lucide-react';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const POS = lazy(() => import('./pages/POS'));
const Products = lazy(() => import('./pages/Products'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Stock = lazy(() => import('./pages/Stock'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/" />;
  }

  return <Layout>{children}</Layout>;
};

const LoginPage: React.FC = () => {
  const { login, user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" />;

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative p-4 font-sans"
      style={{ 
        backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80")',
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 to-black/40 backdrop-blur-[1px]" />

      {/* Login Card - Inspired by Colorlib V01 */}
      <div className="relative z-10 w-full max-w-[480px] bg-white dark:bg-dark rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in zoom-in duration-700">
        {/* Top Branding Area */}
        <div className="bg-primary p-14 text-center relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-white/10 rounded-full blur-xl" />
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/30 shadow-2xl transform hover:rotate-6 transition-transform">
              <LogIn className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter">GKL.co</h1>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Premium POS Solution</p>
          </div>
        </div>

        {/* Form Area */}
        <div className="p-10 md:p-14">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Login</h2>
            <div className="w-16 h-1.5 bg-primary mx-auto mt-3 rounded-full shadow-sm" />
          </div>

          <div className="space-y-8">
            {/* Google Login Button - The functional part */}
            <button
              onClick={login}
              className="w-full bg-white dark:bg-dark/50 border-2 border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-300 py-4 px-6 rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-dark transition-all shadow-sm flex items-center justify-center gap-4 group hover:border-primary/30 hover:shadow-xl active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="text-lg">Masuk dengan Google</span>
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-6 bg-white dark:bg-dark text-gray-400 font-black uppercase tracking-[0.4em]">Atau</span>
              </div>
            </div>

            {/* Placeholder Email/Password Form - Visual only as per current app logic */}
            <div className="space-y-6 opacity-40 pointer-events-none">
              <div className="relative group">
                <input 
                  type="email" 
                  placeholder="Email"
                  className="w-full px-0 py-4 bg-transparent border-b-2 border-gray-100 dark:border-white/10 outline-none focus:border-primary transition-colors placeholder:text-gray-300 font-bold text-lg text-gray-900 dark:text-white"
                  disabled
                />
              </div>
              <div className="relative group">
                <input 
                  type="password" 
                  placeholder="Password"
                  className="w-full px-0 py-4 bg-transparent border-b-2 border-gray-100 dark:border-white/10 outline-none focus:border-primary transition-colors placeholder:text-gray-300 font-bold text-lg text-gray-900 dark:text-white"
                  disabled
                />
              </div>
              <button className="w-full bg-primary/20 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] mt-6 shadow-lg">
                Masuk
              </button>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
              Belum punya akun? <span className="text-primary cursor-pointer hover:underline">Hubungi Admin</span>
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer Credit */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/30">
          &copy; 2024 GKL.co POS System
        </p>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            }>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute roles={['admin']}><Products /></ProtectedRoute>} />
                <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                <Route path="/stock" element={<ProtectedRoute roles={['admin']}><Stock /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
