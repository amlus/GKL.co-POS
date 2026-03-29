import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { LayoutDashboard, ShoppingCart, Package, History, BarChart3, LogOut, User, Settings, Menu, Bell, Search, ChevronDown, Sun, Moon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'cashier'] },
    { name: 'Kasir (POS)', path: '/pos', icon: ShoppingCart, roles: ['admin', 'cashier'] },
    { name: 'Produk', path: '/products', icon: Package, roles: ['admin'] },
    { name: 'Transaksi', path: '/transactions', icon: History, roles: ['admin', 'cashier'] },
    { name: 'Stok', path: '/stock', icon: Settings, roles: ['admin'] },
    { name: 'Laporan', path: '/reports', icon: BarChart3, roles: ['admin'] },
    { name: 'Manajemen Akun', path: '/users', icon: User, roles: ['admin'] },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      {/* Sidebar */}
      <aside className={cn(
        "pc-sidebar",
        isSidebarOpen ? "open" : ""
      )}>
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span>GKL<span className="text-primary">.co</span></span>
          </h1>
        </div>

        <div className="py-6">
          <p className="px-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Navigasi Utama</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              if (!item.roles.includes(profile?.role || '')) return null;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "nav-link",
                    isActive && "active"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Sidebar Overlay */}
      {isSidebarOpen && window.innerWidth <= 1024 && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Header */}
      <header className={cn(
        "pc-header",
        isSidebarOpen && window.innerWidth > 1024 ? "lg:left-64" : "left-0"
      )}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="ml-auto flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari..." 
              className="bg-gray-100 dark:bg-dark/50 border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 w-64 outline-none text-gray-900 dark:text-white"
            />
          </div>

          <button 
            onClick={toggleTheme}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark rounded-full transition-colors"
            title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark rounded-full relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full border-2 border-white dark:border-dark"></span>
          </button>

          <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-2"></div>

          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{profile?.name}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold mt-1 tracking-wider">{profile?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
              {profile?.name?.[0] || 'U'}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>

          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-all ml-2"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={cn(
        "pc-container p-4 lg:p-6",
        isSidebarOpen && window.innerWidth > 1024 ? "lg:pl-64" : "pl-0"
      )}>
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
