import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole, MembershipTier } from '../types';
import { Plus, Search, Edit2, Trash2, User, X, Save, Shield, UserCircle, Star, Award, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'cashier' as UserRole
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as UserProfile & { id: string }));
      setUsers(data);
    });
    return () => unsubscribe();
  }, []);

  const getMembershipTier = (spending: number = 0): MembershipTier => {
    if (spending >= 1000000) return 'platinum';
    if (spending >= 899000) return 'gold';
    if (spending >= 799000) return 'silver';
    return 'none';
  };

  const getTierBadge = (tier: MembershipTier) => {
    switch (tier) {
      case 'platinum':
        return <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider"><Zap className="w-3 h-3" /> Platinum (15%)</span>;
      case 'gold':
        return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider"><Award className="w-3 h-3" /> Gold (10%)</span>;
      case 'silver':
        return <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider"><Star className="w-3 h-3" /> Silver (5%)</span>;
      default:
        return <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Bukan Member</span>;
    }
  };

  const handleOpenModal = (user?: UserProfile & { id: string }) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role
      });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', role: 'cashier' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        // If it's a new user, UID will be empty until they log in
        uid: editingUser?.uid || '',
        createdAt: editingUser?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      if (editingUser) {
        await updateDoc(doc(db, 'users', (editingUser as any).id), dataToSave);
      } else {
        await addDoc(collection(db, 'users'), dataToSave);
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus akun ini?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Manajemen Akun</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm lg:text-base">Kelola akses admin dan kasir secara manual.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center justify-center gap-2 w-full lg:w-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Akun
        </button>
      </header>

      <div className="card">
        <div className="card-header">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari akun..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-dark/50 border border-gray-100 dark:border-white/5 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 lg:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-50/50 dark:bg-dark/50 border-b border-gray-100 dark:border-white/5">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Nama & Email</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Peran</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Membership</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={(user as any).id} className="hover:bg-gray-50/30 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark/50 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                        <UserCircle className="w-6 h-6 text-gray-300 dark:text-gray-700" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider",
                      user.role === 'admin' ? "bg-primary/10 text-primary" : 
                      user.role === 'cashier' ? "bg-success/10 text-success" :
                      "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.role === 'member' ? (
                      <div className="flex flex-col gap-1">
                        {getTierBadge(getMembershipTier(user.monthlySpending))}
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Total: Rp {user.monthlySpending?.toLocaleString() || 0}</p>
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", user.uid ? "bg-success" : "bg-warning")} />
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                        {user.uid ? 'Aktif' : 'Menunggu Login'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(user as any)}
                        className="p-2 text-gray-400 dark:text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete((user as any).id)}
                        className="p-2 text-gray-400 dark:text-gray-600 hover:text-danger hover:bg-danger/5 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center py-20">
              <User className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-4" />
              <p className="text-gray-400 dark:text-gray-600 text-sm">Akun tidak ditemukan.</p>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editingUser ? 'Edit Akun' : 'Tambah Akun Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark rounded-full transition-colors text-gray-900 dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Nama Lengkap</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-dark/50 border border-gray-100 dark:border-white/5 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Email (Google Account)</label>
                  <input
                    required
                    type="email"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-dark/50 border border-gray-100 dark:border-white/5 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Peran</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'admin', label: 'Admin', icon: Shield },
                      { id: 'cashier', label: 'Kasir', icon: User },
                      { id: 'member', label: 'Member', icon: Star }
                    ].map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: role.id as UserRole })}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border font-bold text-xs transition-all",
                          formData.role === role.id
                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                            : "bg-white dark:bg-dark/50 border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:border-primary"
                        )}
                      >
                        <role.icon className="w-4 h-4" />
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark/50 transition-all text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-2.5 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" />
                  {editingUser ? 'Perbarui Akun' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
