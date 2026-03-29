import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot, Timestamp, where } from '../firebase';
import { Transaction } from '../types';
import { Search, Calendar, CreditCard, Banknote, Wallet, ChevronRight, Receipt, X } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    const date = new Date(selectedDate);
    const q = query(
      collection(db, 'transactions'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay(date))),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay(date))),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  const filteredTransactions = transactions.filter(t => 
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.cashierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'Cash': return Banknote;
      case 'QRIS': return CreditCard;
      case 'E-Wallet': return Wallet;
      default: return Receipt;
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-gray-500 mt-1 text-sm lg:text-base">Lihat dan kelola semua catatan penjualan.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-full lg:w-auto">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              className="w-full lg:w-auto pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-lg shadow-sm focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="relative w-full lg:max-w-md mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Cari berdasarkan ID atau kasir..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-lg shadow-sm focus:ring-2 focus:ring-primary outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="overflow-x-auto -mx-4 lg:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">ID Transaksi</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Kasir</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Pembayaran</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Jumlah</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right whitespace-nowrap">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTransactions.map((t) => {
                  const Icon = getPaymentIcon(t.paymentMethod);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-gray-400 whitespace-nowrap">
                        #{t.id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {format(t.timestamp.toDate(), 'HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {t.cashierName[0]}
                          </div>
                          <span className="text-sm font-bold text-gray-900">{t.cashierName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">{t.paymentMethod}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                        Rp {t.finalAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button 
                          onClick={() => setSelectedTransaction(t)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {filteredTransactions.length === 0 && (
          <div className="text-center py-20">
            <Receipt className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-bold">Transaksi tidak ditemukan untuk tanggal ini.</p>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white w-full max-w-md rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 printable-receipt">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 no-print">
              <h2 className="text-lg font-bold text-gray-900">Detail Transaksi</h2>
              <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="text-center pb-6 border-b border-dashed border-gray-200 hidden print:block">
                <h2 className="text-2xl font-bold text-gray-900">GKL.co POS</h2>
                <p className="text-gray-500 text-sm">Struk Pembelian</p>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">ID Transaksi</p>
                  <p className="font-mono text-base font-bold text-gray-900">#{selectedTransaction.id.slice(-8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Tanggal & Waktu</p>
                  <p className="text-sm font-bold text-gray-900">{format(selectedTransaction.timestamp.toDate(), 'dd MMM yyyy, HH:mm:ss')}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Item Pesanan</p>
                <div className="space-y-2 bg-gray-50 rounded-lg p-4 print:bg-white print:p-0">
                  {selectedTransaction.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="text-gray-600 font-medium">{item.quantity}x {item.name}</span>
                        {item.selectedColor && (
                          <span className="text-[10px] text-gray-400 uppercase font-bold">{item.selectedColor}</span>
                        )}
                      </div>
                      <span className="font-bold">Rp {item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-bold">Rp {selectedTransaction.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Diskon</span>
                  <span className="text-danger font-bold">-Rp {selectedTransaction.discount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-2xl font-black text-gray-900 pt-2">
                  <span>Total</span>
                  <span className="text-primary">Rp {selectedTransaction.finalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10 print:bg-white print:border-none print:p-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary no-print">
                    {React.createElement(getPaymentIcon(selectedTransaction.paymentMethod), { className: 'w-5 h-5' })}
                  </div>
                  <div>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Metode Pembayaran</p>
                    <p className="font-bold text-gray-900">{selectedTransaction.paymentMethod}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Kasir</p>
                  <p className="font-bold text-gray-900">{selectedTransaction.cashierName}</p>
                </div>
              </div>

              <div className="pt-6 text-center text-xs text-gray-400 hidden print:block">
                <p className="font-bold text-primary italic">Terima kasih telah berbelanja!</p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex gap-3 no-print">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-white border border-gray-200 py-3 rounded-lg font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                Cetak Struk
              </button>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="flex-1 bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
