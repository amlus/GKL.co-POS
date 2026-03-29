import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot, query, where, addDoc, updateDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { Product, Transaction, TransactionItem, PaymentMethod } from '../types';
import { useAuth } from '../components/AuthContext';
import { Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle2, Receipt, CreditCard, Wallet, Banknote, X, Package } from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const POS: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<TransactionItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [selectingProduct, setSelectingProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data.filter(p => p.stock > 0));
    });
    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const addToCart = (product: Product, color?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.selectedColor === color);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          (item.productId === product.id && item.selectedColor === color)
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        basePrice: product.basePrice || product.price,
        quantity: 1,
        subtotal: product.price,
        selectedColor: color
      }];
    });
    setSelectingProduct(null);
    setSelectedColor('');
  };

  const handleProductClick = (product: Product) => {
    if (product.colors && product.colors.length > 0) {
      setSelectingProduct(product);
      setSelectedColor(product.colors[0]);
    } else {
      addToCart(product);
    }
  };

  const updateQuantity = (productId: string, delta: number, color?: string) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId && item.selectedColor === color) {
        const product = products.find(p => p.id === productId);
        const newQty = Math.max(0, item.quantity + delta);
        if (product && newQty > product.stock) return item;
        return { ...item, quantity: newQty, subtotal: newQty * item.price };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string, color?: string) => {
    setCart(prev => prev.filter(item => !(item.productId === productId && item.selectedColor === color)));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal - discount);

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const transactionData: Omit<Transaction, 'id'> = {
        items: cart,
        totalAmount: subtotal,
        discount: discount,
        finalAmount: total,
        paymentMethod: paymentMethod,
        cashierId: profile?.uid || '',
        cashierName: profile?.name || 'Unknown',
        timestamp: Timestamp.now()
      };

      // 1. Record Transaction
      const docRef = await addDoc(collection(db, 'transactions'), transactionData);
      
      // 2. Update Stock & Create Logs
      for (const item of cart) {
        const productRef = doc(db, 'products', item.productId);
        const product = products.find(p => p.id === item.productId);
        if (product) {
          await updateDoc(productRef, {
            stock: product.stock - item.quantity,
            updatedAt: Timestamp.now()
          });

          await addDoc(collection(db, 'stockLogs'), {
            productId: item.productId,
            productName: item.name,
            changeAmount: -item.quantity,
            type: 'sale',
            timestamp: Timestamp.now(),
            userId: profile?.uid || ''
          });
        }
      }

      setLastTransaction({ id: docRef.id, ...transactionData });
      setCart([]);
      setDiscount(0);
      setShowReceipt(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions/products');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-160px)]">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari produk berdasarkan nama atau kategori..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 content-start">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md hover:border-primary transition-all text-left flex flex-col group relative overflow-hidden"
            >
              <div className="aspect-square bg-gray-50 rounded-lg mb-3 overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Package className="w-10 h-10" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-1">{product.category || 'Umum'}</p>
              <h3 className="font-bold text-gray-900 truncate mb-1 text-sm">{product.name}</h3>
              <div className="flex items-center justify-between mt-auto">
                <p className="text-base font-black text-gray-900">Rp {product.price.toLocaleString()}</p>
                <p className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", product.stock < 10 ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
                  Sisa {product.stock}
                </p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-primary text-white p-2 rounded-lg shadow-lg">
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart & Checkout */}
      <div className="w-96 bg-white border border-gray-100 rounded-lg shadow-xl flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-900">Pesanan Saat Ini</h2>
          </div>
          <span className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {cart.reduce((sum, i) => sum + i.quantity, 0)} item
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.map((item, idx) => (
            <div key={`${item.productId}-${item.selectedColor || 'none'}-${idx}`} className="flex items-center gap-4 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                {item.selectedColor && (
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{item.selectedColor}</p>
                )}
                <p className="text-xs text-gray-500">Rp {item.price.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                <button 
                  onClick={() => updateQuantity(item.productId, -1, item.selectedColor)}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.productId, 1, item.selectedColor)}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <button 
                onClick={() => removeFromCart(item.productId, item.selectedColor)}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-gray-400 text-sm">Keranjang Anda kosong</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Diskon</span>
              <div className="flex items-center gap-2">
                <span className="text-danger font-bold">-</span>
                <input
                  type="number"
                  className="w-20 text-right bg-transparent border-b border-gray-300 focus:border-primary outline-none text-danger font-bold"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-primary">Rp {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Cash', icon: Banknote },
              { id: 'QRIS', icon: CreditCard },
              { id: 'E-Wallet', icon: Wallet }
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                  paymentMethod === method.id 
                    ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                    : "bg-white border-gray-100 text-gray-500 hover:border-primary"
                )}
              >
                <method.icon className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase tracking-wider">{method.id}</span>
              </button>
            ))}
          </div>

          <button
            disabled={cart.length === 0 || isCheckingOut}
            onClick={handleCheckout}
            className="w-full bg-primary text-white py-4 rounded-lg font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
          >
            {isCheckingOut ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                Bayar Sekarang
              </>
            )}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 printable-receipt">
            <div className="p-8 text-center border-b border-dashed border-gray-200 bg-gray-50/50">
              <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4 no-print">
                <Receipt className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">GKL.co POS</h2>
              <p className="text-gray-500 text-sm">ID Transaksi: {lastTransaction.id.slice(-8).toUpperCase()}</p>
            </div>
            
            <div className="p-8 space-y-4">
              <div className="space-y-2">
                {lastTransaction.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-600">{item.quantity}x {item.name}</span>
                      {item.selectedColor && (
                        <span className="text-[10px] text-gray-400 uppercase font-bold">{item.selectedColor}</span>
                      )}
                    </div>
                    <span className="font-bold">Rp {item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>Rp {lastTransaction.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Diskon</span>
                  <span className="text-danger font-bold">-Rp {lastTransaction.discount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xl font-black text-gray-900 pt-2">
                  <span>Total</span>
                  <span className="text-primary">Rp {lastTransaction.finalAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="pt-4 text-center text-xs text-gray-400">
                <p>{format(lastTransaction.timestamp.toDate(), 'dd MMM yyyy, HH:mm')}</p>
                <p>Kasir: {lastTransaction.cashierName}</p>
                <p className="mt-4 font-bold text-primary italic">Terima kasih telah berbelanja!</p>
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
                onClick={() => setShowReceipt(false)}
                className="flex-1 bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color Selection Modal */}
      {selectingProduct && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Pilih Varian Warna</h2>
              <button onClick={() => setSelectingProduct(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden">
                  {selectingProduct.imageUrl ? (
                    <img src={selectingProduct.imageUrl} alt={selectingProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectingProduct.name}</h3>
                  <p className="text-sm text-primary font-black">Rp {selectingProduct.price.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {selectingProduct.colors?.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "px-4 py-3 rounded-lg border font-bold text-sm transition-all",
                      selectedColor === color
                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                        : "bg-white border-gray-100 text-gray-600 hover:border-primary"
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>

              <button
                onClick={() => addToCart(selectingProduct, selectedColor)}
                className="w-full bg-primary text-white py-3 rounded-lg font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
