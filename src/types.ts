import { Timestamp } from './firebase';

export type UserRole = 'admin' | 'cashier';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Timestamp;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  basePrice: number;
  sellingPrice: number;
  stock: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  colors?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TransactionItem {
  productId: string;
  name: string;
  price: number;
  basePrice: number;
  quantity: number;
  subtotal: number;
  selectedColor?: string;
}

export type PaymentMethod = 'Cash' | 'QRIS' | 'E-Wallet';

export interface Transaction {
  id: string;
  items: TransactionItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName: string;
  timestamp: Timestamp;
}

export type StockLogType = 'sale' | 'restock' | 'adjustment';

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  changeAmount: number;
  type: StockLogType;
  timestamp: Timestamp;
  userId: string;
}
