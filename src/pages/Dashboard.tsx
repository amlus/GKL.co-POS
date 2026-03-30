import React, { useEffect, useState } from 'react';
import { db, collection, query, orderBy, limit, onSnapshot, Timestamp, where } from '../firebase';
import { Transaction, Product } from '../types';
import { TrendingUp, ShoppingBag, Package, Users, ArrowUpRight, ArrowDownRight, AlertTriangle, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

const Dashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = startOfDay(new Date());
    const q = query(
      collection(db, 'transactions'),
      where('timestamp', '>=', Timestamp.fromDate(today)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
      setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeProducts();
    };
  }, []);

  const totalSalesToday = transactions.reduce((sum, t) => sum + t.finalAmount, 0);
  const totalTransactionsToday = transactions.length;
  const lowStockThreshold = 5;
  const productsToNotify = products.filter(p => p.stock < lowStockThreshold);
  const lowStockProductsCount = products.filter(p => p.stock < 10).length;

  const stats = [
    { name: 'Total Penjualan Hari Ini', value: `Rp ${totalSalesToday.toLocaleString()}`, icon: TrendingUp, color: 'text-white', bg: 'bg-gradient-to-br from-primary to-secondary' },
    { name: 'Transaksi Hari Ini', value: totalTransactionsToday, icon: ShoppingBag, color: 'text-white', bg: 'bg-gradient-to-br from-success to-[#00d285]' },
    { name: 'Stok Menipis (<10)', value: lowStockProductsCount, icon: Package, color: 'text-white', bg: 'bg-gradient-to-br from-warning to-[#ffcb2b]' },
    { name: 'Total Produk', value: products.length, icon: Users, color: 'text-white', bg: 'bg-gradient-to-br from-info to-[#00e5ff]' },
  ];

  // Mock data for chart (in real app, fetch last 7 days)
  const chartData = [
    { name: 'Sen', sales: 4000 },
    { name: 'Sel', sales: 3000 },
    { name: 'Rab', sales: 2000 },
    { name: 'Kam', sales: 2780 },
    { name: 'Jum', sales: 1890 },
    { name: 'Sab', sales: 2390 },
    { name: 'Min', sales: totalSalesToday },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Ringkasan Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm lg:text-base">Selamat datang kembali! Berikut adalah aktivitas hari ini.</p>
        </div>
      </header>

      {/* Low Stock Notifications */}
      {productsToNotify.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-1">Peringatan Stok Sangat Rendah!</h3>
              <p className="text-red-700 dark:text-red-300 text-sm mb-4">Beberapa produk memiliki stok di bawah {lowStockThreshold} unit. Segera lakukan restok untuk menghindari kehabisan barang.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {productsToNotify.map(product => (
                  <div key={product.id} className="bg-white/60 dark:bg-dark/40 backdrop-blur-sm border border-red-100 dark:border-red-900/30 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate pr-2">{product.name}</span>
                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap">
                      Sisa {product.stock}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="stat-card">
            <div className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center shadow-lg shadow-primary/20`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{stat.name}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tren Penjualan Mingguan</h2>
            <select className="text-xs border-none bg-gray-50 dark:bg-dark/50 text-gray-900 dark:text-white rounded-lg px-3 py-1 focus:ring-0 outline-none">
              <option>7 Hari Terakhir</option>
              <option>30 Hari Terakhir</option>
            </select>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4680ff" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4680ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1a1c23', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)'}}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#4680ff" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transaksi Terbaru</h2>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {transactions.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-dark/50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {t.cashierName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Rp {t.finalAmount.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{format(t.timestamp.toDate(), 'HH:mm')}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                    t.paymentMethod === 'Cash' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'
                  }`}>
                    {t.paymentMethod}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingBag className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Belum ada transaksi hari ini.</p>
                </div>
              )}
            </div>
            <button className="w-full mt-6 py-2 text-sm text-primary font-bold hover:underline">
              Lihat Semua Transaksi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
