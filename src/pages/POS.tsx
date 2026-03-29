import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot, query, where, addDoc, updateDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { Product, Transaction, TransactionItem, PaymentMethod, UserProfile } from '../types';
import { useAuth } from '../components/AuthContext';
import { Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle2, Receipt, CreditCard, Wallet, Banknote, X, Package, Barcode, QrCode, Layers, User as UserIcon, Star, Award, Zap } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
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
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          price: d.price || 0,
          basePrice: d.basePrice || d.price || 0,
          stock: d.stock || 0
        } as Product;
      });
      setProducts(data.filter(p => p.stock > 0));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setMembers(data.filter((u: any) => u.role === 'member'));
    });
    return () => unsubscribe();
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const getMembershipDiscount = (spending: number = 0) => {
    if (spending >= 1000000) return 0.15; // 15%
    if (spending >= 899000) return 0.10; // 10%
    if (spending >= 799000) return 0.05; // 5%
    return 0;
  };

  const memberDiscountAmount = useMemo(() => {
    if (!selectedMember) return 0;
    const rate = getMembershipDiscount(selectedMember.monthlySpending || 0);
    return subtotal * rate;
  }, [selectedMember, subtotal]);

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // Barcode scanning logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input, don't trigger barcode logic
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Simple buffer for barcode scanning
      // Most scanners send characters quickly followed by Enter
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart]);

  // QR Scanner logic
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (isQRScannerOpen) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      const onScanSuccess = (decodedText: string) => {
        const product = products.find(p => p.barcode === decodedText);
        if (product) {
          handleProductClick(product);
          setIsQRScannerOpen(false);
          // Optional: Add a small sound or vibration feedback here
        }
      };

      const onScanFailure = (error: any) => {
        // console.warn(`Code scan error = ${error}`);
      };

      scanner.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      }
    };
  }, [isQRScannerOpen, products]);

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.barcode === searchQuery);
    if (product) {
      handleProductClick(product);
      setSearchQuery('');
    }
  };

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
        selectedColor: color || null
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

  const total = Math.max(0, subtotal - discount - memberDiscountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const transactionData: Omit<Transaction, 'id'> = {
        items: cart.map(item => ({
          productId: item.productId || '',
          name: item.name || 'Unknown',
          price: item.price || 0,
          basePrice: item.basePrice || item.price || 0,
          quantity: item.quantity || 0,
          subtotal: item.subtotal || 0,
          selectedColor: item.selectedColor || null
        })),
        totalAmount: subtotal || 0,
        discount: discount || 0,
        memberDiscount: memberDiscountAmount || 0,
        finalAmount: total || 0,
        paymentMethod: paymentMethod || 'Cash',
        cashierId: profile?.uid || '',
        cashierName: profile?.name || 'Unknown',
        timestamp: Timestamp.now()
      };

      // 1. Record Transaction
      const docRef = await addDoc(collection(db, 'transactions'), {
        ...transactionData,
        memberId: selectedMember?.uid || '',
        memberName: selectedMember?.name || ''
      });
      
      // 2. Update Stock & Create Logs
      for (const item of cart) {
        const productRef = doc(db, 'products', item.productId);
        const product = products.find(p => p.id === item.productId);
        if (product) {
          await updateDoc(productRef, {
            stock: (product.stock || 0) - item.quantity,
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

      // 3. Update Member Spending
      if (selectedMember) {
        const memberRef = doc(db, 'users', (selectedMember as any).id);
        const lastUpdate = selectedMember.updatedAt?.toDate() || new Date();
        const now = new Date();
        
        // Reset spending if it's a new month
        const isNewMonth = lastUpdate.getMonth() !== now.getMonth() || lastUpdate.getFullYear() !== now.getFullYear();
        const currentSpending = isNewMonth ? 0 : (selectedMember.monthlySpending || 0);

        await updateDoc(memberRef, {
          monthlySpending: currentSpending + total,
          updatedAt: Timestamp.now()
        });
      }

      setLastTransaction({ id: docRef.id, ...transactionData });
      setCart([]);
      setDiscount(0);
      setSelectedMember(null);
      setShowReceipt(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions/products');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!lastTransaction) return;

    const windowUrl = 'about:blank';
    const uniqueName = new Date();
    const windowName = 'PrintReceipt' + uniqueName.getTime();
    const printWindow = window.open(windowUrl, windowName, 'width=400,height=600');

    if (printWindow) {
      const itemsHtml = lastTransaction.items.map(item => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
          <div style="display: flex; flex-direction: column;">
            <span>${item.quantity}x ${item.name}</span>
            ${item.selectedColor ? `<span style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold;">${item.selectedColor}</span>` : ''}
          </div>
          <span style="font-weight: bold;">Rp ${item.subtotal.toLocaleString()}</span>
        </div>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Struk Belanja - ${lastTransaction.id.slice(-8).toUpperCase()}</title>
            <style>
              body { font-family: 'Courier New', Courier, monospace; padding: 20px; margin: 0; color: #000; }
              .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
              .header h2 { margin: 0; font-size: 20px; }
              .header p { margin: 5px 0 0; font-size: 12px; color: #333; }
              .items { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
              .totals { space-y: 4px; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
              .total-row { display: flex; justify-content: space-between; font-size: 12px; }
              .grand-total { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 8px; }
              .footer { text-align: center; font-size: 11px; color: #666; margin-top: 15px; }
              .footer p { margin: 2px 0; }
              @media print {
                body { padding: 10px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>GKL.co POS</h2>
              <p>ID Transaksi: ${lastTransaction.id.slice(-8).toUpperCase()}</p>
            </div>
            
            <div class="items">
              ${itemsHtml}
            </div>
            
            <div class="totals">
              <div class="total-row">
                <span>Subtotal</span>
                <span>Rp ${lastTransaction.totalAmount.toLocaleString()}</span>
              </div>
              <div class="total-row">
                <span>Diskon</span>
                <span>-Rp ${lastTransaction.discount.toLocaleString()}</span>
              </div>
              ${lastTransaction.memberDiscount && lastTransaction.memberDiscount > 0 ? `
              <div class="total-row" style="color: #4f46e5; font-weight: bold;">
                <span>Diskon Member</span>
                <span>-Rp ${lastTransaction.memberDiscount.toLocaleString()}</span>
              </div>
              ` : ''}
              <div class="grand-total">
                <span>Total</span>
                <span>Rp ${lastTransaction.finalAmount.toLocaleString()}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>${format(lastTransaction.timestamp.toDate(), 'dd MMM yyyy, HH:mm')}</p>
              <p>Kasir: ${lastTransaction.cashierName}</p>
              <p style="margin-top: 10px; font-weight: bold; font-style: italic;">Terima kasih telah berbelanja!</p>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-auto lg:h-[calc(100vh-160px)]">
      {/* Product Selection */}
      <div className={cn(
        "flex-1 flex flex-col gap-4 lg:gap-6 min-w-0",
        showCartMobile && "hidden lg:flex"
      )}>
        <form onSubmit={handleBarcodeSearch} className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari produk atau scan barcode..."
              className="w-full pl-12 pr-12 py-3 lg:py-4 bg-white dark:bg-dark border border-gray-100 dark:border-white/5 rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm lg:text-base text-gray-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300">
              <Barcode className="w-5 h-5" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsQRScannerOpen(true)}
            className="p-3 lg:p-4 bg-white dark:bg-dark border border-gray-100 dark:border-white/5 rounded-lg shadow-sm hover:border-primary hover:text-primary transition-all flex items-center justify-center"
            title="Scan QR Code"
          >
            <QrCode className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 content-start pb-24 lg:pb-0">
          {filteredProducts.map((product) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={product.id}
              className="bg-white dark:bg-dark rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col group relative overflow-hidden"
            >
              {/* Product Image Section */}
              <div className="aspect-square bg-gray-50 dark:bg-dark/50 relative overflow-hidden">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-200 dark:text-gray-800">
                    <Package className="w-12 h-12" />
                  </div>
                )}
                
                {/* Dynamic Overlay Button */}
                <div className="absolute inset-0 bg-dark/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center p-4">
                  <button
                    onClick={() => handleProductClick(product)}
                    className="w-full bg-white dark:bg-dark text-dark dark:text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex items-center justify-center gap-2 hover:bg-primary hover:text-white"
                  >
                    {product.colors && product.colors.length > 0 ? (
                      <>
                        <Layers className="w-4 h-4" />
                        Pilih Varian
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Tambah
                      </>
                    )}
                  </button>
                </div>

                {/* Stock Badge */}
                <div className={cn(
                  "absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-sm backdrop-blur-md",
                  product.stock < 10 ? "bg-warning/90 text-white" : "bg-white/90 dark:bg-dark/90 text-gray-600 dark:text-gray-300"
                )}>
                  {product.stock} Tersedia
                </div>

                {/* Barcode Badge */}
                {product.barcode && (
                  <div className="absolute top-3 left-3 bg-dark/60 text-white px-2 py-1 rounded-lg text-[9px] font-mono backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {product.barcode}
                  </div>
                )}
              </div>

              {/* Product Info Section */}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-primary font-black uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-md">
                    {product.category || 'Umum'}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="mt-auto pt-2 border-t border-gray-50 dark:border-white/5 flex items-end justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">Harga</span>
                    <span className="text-base font-black text-gray-900 dark:text-white">
                      Rp {product.price.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleProductClick(product)}
                    className="lg:hidden w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 active:scale-90 transition-transform"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cart & Checkout */}
      <AnimatePresence>
        {(showCartMobile || window.innerWidth >= 1024) && (
          <motion.div 
            initial={window.innerWidth < 1024 ? { y: '100%' } : { x: '100%' }}
            animate={window.innerWidth < 1024 ? { y: 0 } : { x: 0 }}
            exit={window.innerWidth < 1024 ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "bg-white flex flex-col overflow-hidden z-50",
              "fixed inset-0 lg:relative lg:inset-auto lg:w-96 lg:flex lg:border lg:border-gray-100 lg:rounded-lg lg:shadow-xl"
            )}
          >
            <div className="p-4 lg:p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark/50">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowCartMobile(false)}
                  className="lg:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <h2 className="text-base lg:text-lg font-bold text-gray-900 dark:text-white">Pesanan Saat Ini</h2>
                </div>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(true)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
                  selectedMember 
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50" 
                    : "bg-gray-100 dark:bg-dark/50 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark"
                )}
              >
                <UserIcon className="w-3 h-3" />
                {selectedMember ? selectedMember.name : 'Pilih Member'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
              {cart.map((item, idx) => (
                <div key={`${item.productId}-${item.selectedColor || 'none'}-${idx}`} className="flex items-center gap-4 group bg-white dark:bg-dark p-3 rounded-xl border border-gray-50 dark:border-white/5 shadow-sm lg:shadow-none lg:border-none lg:p-0">
                  <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-dark/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {products.find(p => p.id === item.productId)?.imageUrl ? (
                      <img src={products.find(p => p.id === item.productId)?.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-300 dark:text-gray-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                    {item.selectedColor && (
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{item.selectedColor}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Rp {item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark/50 rounded-xl p-1">
                    <button 
                      onClick={() => updateQuantity(item.productId, -1, item.selectedColor)}
                      className="w-8 h-8 flex items-center justify-center bg-white dark:bg-dark rounded-lg shadow-sm hover:text-primary transition-all active:scale-90 text-gray-900 dark:text-white"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold w-8 text-center text-gray-900 dark:text-white">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, 1, item.selectedColor)}
                      className="w-8 h-8 flex items-center justify-center bg-white dark:bg-dark rounded-lg shadow-sm hover:text-primary transition-all active:scale-90 text-gray-900 dark:text-white"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.productId, item.selectedColor)}
                    className="p-2 text-gray-300 dark:text-gray-700 hover:text-danger transition-colors active:scale-90"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-dark/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-10 h-10 text-gray-200 dark:text-gray-800" />
                  </div>
                  <p className="text-gray-400 dark:text-gray-600 text-sm font-medium">Keranjang Anda kosong</p>
                </div>
              )}
            </div>

            <div className="p-4 lg:p-6 bg-gray-50 dark:bg-dark/50 border-t border-gray-100 dark:border-white/5 space-y-4 pb-safe">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900 dark:text-white">Rp {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Diskon</span>
                  <div className="flex items-center gap-2">
                    <span className="text-danger font-bold">-</span>
                    <input
                      type="number"
                      className="w-24 text-right bg-white dark:bg-dark border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1 focus:border-primary outline-none text-danger font-bold text-sm"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                    />
                  </div>
                </div>
                {selectedMember && memberDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                    <div className="flex items-center gap-1">
                      <span>Diskon Member</span>
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 px-1 rounded">
                        {getMembershipDiscount(selectedMember.monthlySpending || 0) * 100}%
                      </span>
                    </div>
                    <span>-Rp {memberDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-black text-gray-900 dark:text-white pt-4 border-t border-gray-200 dark:border-white/5">
                  <span>Total</span>
                  <span className="text-primary">Rp {total.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Cash', icon: Banknote },
                  { id: 'QRIS', icon: CreditCard },
                  { id: 'E-Wallet', icon: Wallet }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all active:scale-95",
                      paymentMethod === method.id 
                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                        : "bg-white dark:bg-dark border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:border-primary"
                    )}
                  >
                    <method.icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{method.id}</span>
                  </button>
                ))}
              </div>

              <button
                disabled={cart.length === 0 || isCheckingOut}
                onClick={handleCheckout}
                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Cart Toggle */}
      <AnimatePresence>
        {!showCartMobile && cart.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-6 right-6 lg:hidden z-40"
          >
            <button
              onClick={() => setShowCartMobile(true)}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-2xl shadow-primary/40 flex items-center justify-between px-6 active:scale-95 transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-2 -right-2 bg-white text-primary text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-primary shadow-sm">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] uppercase tracking-widest font-black opacity-80">Keranjang</span>
                  <span className="text-sm font-bold">Lihat Pesanan</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-widest font-black opacity-80">Total</span>
                <span className="text-lg font-black">Rp {total.toLocaleString()}</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      {isQRScannerOpen && (
        <div className="fixed inset-0 bg-dark/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark/50">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Scan QR Code</h2>
              </div>
              <button onClick={() => setIsQRScannerOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark rounded-full transition-colors text-gray-900 dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div id="qr-reader" className="overflow-hidden rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark/50"></div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                Arahkan kamera ke QR Code produk untuk menambahkannya ke keranjang.
              </p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-dark/50 border-t border-gray-100 dark:border-white/5">
              <button
                onClick={() => setIsQRScannerOpen(false)}
                className="w-full py-3 bg-white dark:bg-dark border border-gray-200 dark:border-white/5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark/80 transition-all"
              >
                Tutup Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white dark:bg-dark w-full max-w-sm rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 printable-receipt">
            <div className="p-8 text-center border-b border-dashed border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-dark/50">
              <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4 no-print">
                <Receipt className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">GKL.co POS</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">ID Transaksi: {lastTransaction.id.slice(-8).toUpperCase()}</p>
            </div>
            
            <div className="p-8 space-y-4">
              <div className="space-y-2">
                {lastTransaction.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-600 dark:text-gray-400">{item.quantity}x {item.name}</span>
                      {item.selectedColor && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">{item.selectedColor}</span>
                      )}
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">Rp {item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="text-gray-900 dark:text-white">Rp {lastTransaction.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Diskon</span>
                  <span className="text-danger font-bold">-Rp {lastTransaction.discount.toLocaleString()}</span>
                </div>
                {lastTransaction.memberDiscount && lastTransaction.memberDiscount > 0 && (
                  <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                    <span>Diskon Member</span>
                    <span>-Rp {lastTransaction.memberDiscount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black text-gray-900 dark:text-white pt-2">
                  <span>Total</span>
                  <span className="text-primary">Rp {lastTransaction.finalAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="pt-4 text-center text-xs text-gray-400 dark:text-gray-500">
                <p>{format(lastTransaction.timestamp.toDate(), 'dd MMM yyyy, HH:mm')}</p>
                <p>Kasir: {lastTransaction.cashierName}</p>
                <p className="mt-4 font-bold text-primary italic">Terima kasih telah berbelanja!</p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-dark/50 flex gap-3 no-print">
              <button 
                onClick={handlePrintReceipt}
                className="flex-1 bg-white dark:bg-dark border border-gray-200 dark:border-white/5 py-3 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark/80 transition-colors flex items-center justify-center gap-2"
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

      {/* Member Selection Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark/50">
              <div className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pilih Member</h2>
              </div>
              <button onClick={() => setIsMemberModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark rounded-full transition-colors text-gray-900 dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari member..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-dark/50 border border-gray-100 dark:border-white/5 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                <button
                  onClick={() => {
                    setSelectedMember(null);
                    setIsMemberModalOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark/50 transition-all text-sm font-bold"
                >
                  Tanpa Member
                </button>
                {filteredMembers.map((member) => {
                  const discount = getMembershipDiscount(member.monthlySpending || 0);
                  return (
                    <button
                      key={(member as any).id}
                      onClick={() => {
                        setSelectedMember(member);
                        setIsMemberModalOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group",
                        selectedMember?.uid === member.uid
                          ? "bg-primary border-primary text-white"
                          : "bg-white dark:bg-dark border-gray-100 dark:border-white/5 hover:border-primary"
                      )}
                    >
                      <div>
                        <p className={cn("font-bold text-sm", selectedMember?.uid === member.uid ? "text-white" : "text-gray-900 dark:text-white")}>{member.name}</p>
                        <p className={cn("text-[10px]", selectedMember?.uid === member.uid ? "text-white/70" : "text-gray-400 dark:text-gray-500")}>
                          {member.email}
                        </p>
                      </div>
                      {discount > 0 && (
                        <span className={cn(
                          "text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider",
                          selectedMember?.uid === member.uid ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        )}>
                          {discount * 100}% OFF
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Color Selection Modal */}
      {selectingProduct && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white dark:bg-dark w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pilih Varian Warna</h2>
              <button onClick={() => setSelectingProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark rounded-full transition-colors text-gray-900 dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-dark/50 overflow-hidden">
                  {selectingProduct.imageUrl ? (
                    <img src={selectingProduct.imageUrl} alt={selectingProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{selectingProduct.name}</h3>
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
                        : "bg-white dark:bg-dark border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:border-primary"
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
