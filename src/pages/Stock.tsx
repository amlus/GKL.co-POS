import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, updateDoc, addDoc, doc, Timestamp, handleFirestoreError, OperationType, query, orderBy, limit } from '../firebase';
import { Product, StockLog } from '../types';
import { useAuth } from '../components/AuthContext';
import { Package, Search, Plus, Minus, History, Save, X, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Stock: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<'restock' | 'adjustment'>('restock');

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          stock: d.stock || 0
        } as Product;
      });
      setProducts(data);
    });

    const qLogs = query(collection(db, 'stockLogs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockLog));
      setStockLogs(data);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeLogs();
    };
  }, []);

  const handleAdjustment = async () => {
    if (!selectedProduct || adjustmentAmount === 0) return;

    try {
      const newStock = selectedProduct.stock + adjustmentAmount;
      if (newStock < 0) {
        alert('Stock cannot be negative');
        return;
      }

      // 1. Update Product Stock
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        stock: newStock,
        updatedAt: Timestamp.now()
      });

      // 2. Create Stock Log
      await addDoc(collection(db, 'stockLogs'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        changeAmount: adjustmentAmount,
        type: adjustmentType,
        timestamp: Timestamp.now(),
        userId: profile?.uid || ''
      });

      setSelectedProduct(null);
      setAdjustmentAmount(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products/stockLogs');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Manajemen Stok</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm lg:text-base">Pantau tingkat inventaris dan sesuaikan stok secara manual.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Inventory List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari produk..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark border border-gray-100 dark:border-white/5 rounded-lg shadow-sm focus:ring-2 focus:ring-primary outline-none text-sm text-gray-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="card">
            <div className="overflow-x-auto -mx-4 lg:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-dark/50 border-b border-gray-100 dark:border-white/5">
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Produk</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Stok Saat Ini</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark/50 flex items-center justify-center flex-shrink-0">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-300 dark:text-gray-700" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white text-sm">{product.name}</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider">{product.category || 'Umum'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {product.stock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                            product.stock === 0 ? "bg-danger/10 text-danger" :
                            product.stock < 10 ? "bg-warning/10 text-warning" :
                            "bg-success/10 text-success"
                          )}>
                            {product.stock === 0 ? 'Stok Habis' : product.stock < 10 ? 'Stok Menipis' : 'Tersedia'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button 
                            onClick={() => setSelectedProduct(product)}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Sesuaikan Stok
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Log Stok Terbaru</h2>
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {stockLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-gray-100 dark:hover:border-white/10">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      log.type === 'sale' ? "bg-danger/10 text-danger" :
                      log.type === 'restock' ? "bg-success/10 text-success" :
                      "bg-primary/10 text-primary"
                    )}>
                      {log.changeAmount > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{log.productName}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                          {log.changeAmount > 0 ? '+' : ''}{log.changeAmount} unit • {log.type}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">{format(log.timestamp.toDate(), 'HH:mm')}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {stockLogs.length === 0 && (
                  <div className="text-center py-12">
                    <RefreshCw className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
                    <p className="text-gray-400 dark:text-gray-600 text-sm">Belum ada log stok.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Adjustment Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark w-full max-w-md rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sesuaikan Stok</h2>
              <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-dark rounded-full transition-colors text-gray-900 dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-dark/50 rounded-lg border border-gray-100 dark:border-white/5">
                <div className="w-12 h-12 rounded-lg bg-white dark:bg-dark flex items-center justify-center shadow-sm">
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                  ) : (
                    <Package className="w-6 h-6 text-gray-300 dark:text-gray-700" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Produk</p>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedProduct.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Stok Saat Ini: {selectedProduct.stock}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAdjustmentType('restock')}
                    className={cn(
                      "py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border",
                      adjustmentType === 'restock' ? "bg-success border-success text-white shadow-lg shadow-success/20" : "bg-white dark:bg-dark border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400"
                    )}
                  >
                    Restok (+)
                  </button>
                  <button
                    onClick={() => setAdjustmentType('adjustment')}
                    className={cn(
                      "py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border",
                      adjustmentType === 'adjustment' ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" : "bg-white dark:bg-dark border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400"
                    )}
                  >
                    Penyesuaian (+/-)
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Jumlah Perubahan</label>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setAdjustmentAmount(prev => prev - 1)}
                      className="p-3 bg-gray-100 dark:bg-dark/50 rounded-lg hover:bg-gray-200 dark:hover:bg-dark transition-colors text-gray-900 dark:text-white"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      className="flex-1 text-center py-3 bg-gray-50 dark:bg-dark/50 border border-gray-100 dark:border-white/5 rounded-lg text-2xl font-black outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 dark:text-white"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                    />
                    <button 
                      onClick={() => setAdjustmentAmount(prev => prev + 1)}
                      className="p-3 bg-gray-100 dark:bg-dark/50 rounded-lg hover:bg-gray-200 dark:hover:bg-dark transition-colors text-gray-900 dark:text-white"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-dark/50 rounded-lg flex justify-between items-center border border-gray-100 dark:border-white/5">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Level Stok Baru</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{selectedProduct.stock + adjustmentAmount}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-dark/50 flex gap-3">
              <button 
                onClick={() => setSelectedProduct(null)}
                className="flex-1 bg-white dark:bg-dark border border-gray-200 dark:border-white/10 py-3 rounded-lg font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark/50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleAdjustment}
                disabled={adjustmentAmount === 0}
                className="flex-1 bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
