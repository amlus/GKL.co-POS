import React, { Suspense, lazy, useState } from 'react';
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
  const { login, loginWithEmail, user, loading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        // Import createUserWithEmailAndPassword and setDoc from firebase
        const { createUserWithEmailAndPassword, setDoc, doc, db, Timestamp } = await import('./firebase');
        const { auth } = await import('./firebase');
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        // Create profile in Firestore
        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          name: name,
          email: email,
          role: 'admin', // First user registered via this form is admin
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Login/Register error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('PENTING: Fitur Login Email belum diaktifkan di Firebase Console. Silakan buka Firebase Console > Authentication > Sign-in method dan aktifkan "Email/Password".');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Koneksi internet terganggu atau diblokir. Silakan periksa koneksi Anda atau matikan Ad-Blocker jika ada.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Silakan login.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah (min. 6 karakter).');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError('Gagal masuk: ' + (err.message || 'Email atau password salah.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-widest">
              {isRegistering ? 'Daftar Admin' : 'Login'}
            </h2>
            <div className="w-16 h-1.5 bg-primary mx-auto mt-3 rounded-full shadow-sm" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold text-center uppercase tracking-wider animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {isRegistering && (
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder="Nama Lengkap"
                    required
                    className="w-full px-0 py-4 bg-transparent border-b-2 border-gray-100 dark:border-white/10 outline-none focus:border-primary transition-colors placeholder:text-gray-300 font-bold text-lg text-gray-900 dark:text-white"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              <div className="relative group">
                <input 
                  type="email" 
                  placeholder="Email"
                  required
                  className="w-full px-0 py-4 bg-transparent border-b-2 border-gray-100 dark:border-white/10 outline-none focus:border-primary transition-colors placeholder:text-gray-300 font-bold text-lg text-gray-900 dark:text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="relative group">
                <input 
                  type="password" 
                  placeholder="Password"
                  required
                  className="w-full px-0 py-4 bg-transparent border-b-2 border-gray-100 dark:border-white/10 outline-none focus:border-primary transition-colors placeholder:text-gray-300 font-bold text-lg text-gray-900 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] mt-6 shadow-lg hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses...' : (isRegistering ? 'Daftar Sekarang' : 'Masuk')}
              </button>
            </div>
          </form>

          {!isRegistering && (
            <div className="mt-8">
              <div className="relative flex items-center justify-center mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100 dark:border-white/10"></div>
                </div>
                <div className="relative z-10 px-4 bg-white dark:bg-dark text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
                  Atau masuk dengan
                </div>
              </div>

              <button 
                onClick={async () => {
                  try {
                    setError('');
                    await login();
                  } catch (err: any) {
                    console.error('Google login error:', err);
                    setError('Gagal masuk dengan Google. Pastikan Google Auth sudah diaktifkan di Firebase Console.');
                  }
                }}
                className="w-full flex items-center justify-center gap-4 bg-white dark:bg-white/5 border-2 border-gray-100 dark:border-white/10 text-gray-900 dark:text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
            </div>
          )}

          <div className="mt-16 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
              {isRegistering ? 'Sudah punya akun?' : 'Belum punya akun?'} 
              <span 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-primary cursor-pointer hover:underline ml-2"
              >
                {isRegistering ? 'Login di sini' : 'Daftar Admin Pertama'}
              </span>
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
