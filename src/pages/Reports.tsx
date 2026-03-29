import React, { useState, useEffect } from 'react';
import { db, collection, query, where, getDocs, Timestamp, orderBy } from '../firebase';
import { Transaction, Product } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar, TrendingUp, ShoppingBag, Package, Download, ChevronRight } from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

const COLORS = ['#4680ff', '#11c15b', '#ffa21d', '#ff5252', '#00bcd4', '#3f4d67'];

const Reports: React.FC = () => {
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let start: Date;
      let end: Date = endOfDay(new Date());

      if (timeRange === 'day') {
        start = startOfDay(new Date());
      } else if (timeRange === 'week') {
        start = startOfWeek(new Date());
      } else {
        start = startOfMonth(new Date());
      }

      const q = query(
        collection(db, 'transactions'),
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<=', Timestamp.fromDate(end)),
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);

      const prodSnapshot = await getDocs(collection(db, 'products'));
      setProducts(prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    };

    fetchData();
  }, [timeRange]);

  const totalSales = transactions.reduce((sum, t) => sum + t.finalAmount, 0);
  const totalCost = transactions.reduce((sum, t) => 
    sum + t.items.reduce((s, i) => s + ((i.basePrice || i.price) * i.quantity), 0), 0
  );
  const totalProfit = totalSales - totalCost;
  const totalItems = transactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0);
  const avgTransaction = transactions.length > 0 ? totalSales / transactions.length : 0;

  // Category sales data
  const categoryData = transactions.reduce((acc: any, t) => {
    t.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const category = product?.category || 'General';
      const existing = acc.find((a: any) => a.name === category);
      if (existing) {
        existing.value += item.subtotal;
      } else {
        acc.push({ name: category, value: item.subtotal });
      }
    });
    return acc;
  }, []);

  // Daily sales data for line chart
  const dailyData = transactions.reduce((acc: any, t) => {
    const day = format(t.timestamp.toDate(), 'dd MMM');
    const existing = acc.find((a: any) => a.day === day);
    if (existing) {
      existing.sales += t.finalAmount;
    } else {
      acc.push({ day, sales: t.finalAmount });
    }
    return acc;
  }, []);

  // Calculate top selling products
  const topProducts = transactions.reduce((acc: any, t) => {
    t.items.forEach(item => {
      const existing = acc.find((a: any) => a.productId === item.productId);
      const itemProfit = item.subtotal - ((item.basePrice || item.price) * item.quantity);
      if (existing) {
        existing.sales += item.quantity;
        existing.revenue += item.subtotal;
        existing.profit += itemProfit;
      } else {
        const product = products.find(p => p.id === item.productId);
        acc.push({
          productId: item.productId,
          name: item.name,
          category: product?.category || 'Umum',
          sales: item.quantity,
          revenue: item.subtotal,
          profit: itemProfit
        });
      }
    });
    return acc;
  }, []).sort((a: any, b: any) => b.sales - a.sales).slice(0, 10);

  const stats = [
    { name: 'Total Pendapatan', value: `Rp ${totalSales.toLocaleString()}`, icon: TrendingUp, color: 'text-white', bg: 'bg-primary' },
    { name: 'Total Laba', value: `Rp ${totalProfit.toLocaleString()}`, icon: TrendingUp, color: 'text-white', bg: 'bg-success' },
    { name: 'Total Item Terjual', value: totalItems, icon: ShoppingBag, color: 'text-white', bg: 'bg-info' },
    { name: 'Total Transaksi', value: transactions.length, icon: Calendar, color: 'text-white', bg: 'bg-warning' },
  ];

  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    const headers = ['ID Transaksi', 'Tanggal', 'Waktu', 'Kasir', 'Subtotal', 'Diskon Manual', 'Diskon Member', 'Total Akhir', 'Metode Pembayaran'];
    const rows = transactions.map(t => [
      t.id,
      format(t.timestamp.toDate(), 'yyyy-MM-dd'),
      format(t.timestamp.toDate(), 'HH:mm:ss'),
      `"${t.cashierName}"`,
      t.totalAmount,
      t.discount,
      t.memberDiscount || 0,
      t.finalAmount,
      t.paymentMethod
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Penjualan_${timeRange}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Laporan Penjualan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm lg:text-base">Analisis kinerja bisnis Anda dari waktu ke waktu.</p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
          <div className="bg-white dark:bg-dark border border-gray-100 dark:border-white/5 rounded-lg p-1 flex gap-1 shadow-sm shrink-0">
            {(['day', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all whitespace-nowrap ${
                  timeRange === r ? 'bg-primary text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {r === 'day' ? 'Hari' : r === 'week' ? 'Minggu' : 'Bulan'}
              </button>
            ))}
          </div>
          <button 
            onClick={exportToCSV}
            className="p-2.5 bg-white dark:bg-dark border border-gray-100 dark:border-white/5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm transition-all shrink-0"
            title="Ekspor CSV"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="card overflow-hidden">
            <div className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center shadow-lg shadow-gray-200 dark:shadow-none`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{stat.name}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tren Pendapatan</h2>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000'}}
                    itemStyle={{color: theme === 'dark' ? '#fff' : '#000'}}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#4680ff" strokeWidth={4} dot={{r: 4, fill: '#4680ff', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Penjualan Berdasarkan Kategori</h2>
          </div>
          <div className="card-body">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-64 md:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000'}}
                      itemStyle={{color: theme === 'dark' ? '#fff' : '#000'}}
                      formatter={(value: number) => `Rp ${value.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-48 space-y-3">
                {categoryData.map((entry: any, index: number) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate flex-1">{entry.name}</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{Math.round((entry.value / totalSales) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Produk Terlaris</h2>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            {topProducts.map((item: any, idx: number) => (
              <div key={item.productId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all group border border-transparent hover:border-gray-100 dark:hover:border-white/10 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider">{item.category}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-12">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Unit</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{item.sales}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Pendapatan</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Rp {item.revenue.toLocaleString()}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Laba</p>
                    <p className="text-sm font-bold text-success">Rp {item.profit.toLocaleString()}</p>
                  </div>
                  <ChevronRight className="hidden sm:block w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-600 text-sm">Belum ada data penjualan untuk periode ini.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
