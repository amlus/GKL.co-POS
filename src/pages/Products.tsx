import React, { useState, useEffect, useRef } from 'react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Package, X, Save, Image as ImageIcon, Download, Upload, FileSpreadsheet, Barcode as BarcodeIcon, Printer, RefreshCw } from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price: 0,
    basePrice: 0,
    sellingPrice: 0,
    stock: 0,
    category: '',
    description: '',
    imageUrl: '',
    colors: ''
  });
  const [showBarcodeModal, setShowBarcodeModal] = useState<Product | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          // Ensure basePrice and sellingPrice exist for older records
          basePrice: d.basePrice || d.price || 0,
          sellingPrice: d.sellingPrice || d.price || 0
        } as Product;
      });
      setProducts(data);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        barcode: product.barcode || '',
        price: product.price,
        basePrice: product.basePrice || product.price,
        sellingPrice: product.sellingPrice || product.price,
        stock: product.stock,
        category: product.category || '',
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        colors: product.colors?.join(', ') || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', barcode: '', price: 0, basePrice: 0, sellingPrice: 0, stock: 0, category: '', description: '', imageUrl: '', colors: '' });
    }
    setIsModalOpen(true);
  };

  const generateBarcode = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData({ ...formData, barcode: `GKL${timestamp.slice(-8)}${random}` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        colors: formData.colors.split(',').map(c => c.trim()).filter(c => c !== ''),
        // Ensure price is always the same as sellingPrice for POS compatibility
        price: formData.sellingPrice,
        updatedAt: Timestamp.now()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), dataToSave);
      } else {
        await addDoc(collection(db, 'products'), {
          ...dataToSave,
          createdAt: Timestamp.now()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    const headers = ['Nama', 'Barcode', 'Kategori', 'Harga Dasar', 'Harga Jual', 'Stok', 'Deskripsi', 'URL Gambar'];
    const rows = products.map(p => [
      `"${p.name}"`,
      `"${p.barcode || ''}"`,
      `"${p.category || ''}"`,
      p.basePrice || p.price,
      p.sellingPrice || p.price,
      p.stock,
      `"${p.description || ''}"`,
      `"${p.imageUrl || ''}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daftar_Produk_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const headers = lines[0].split(',');
      const dataRows = lines.slice(1).filter(line => line.trim() !== '');

      let importedCount = 0;
      let errorCount = 0;

      for (const row of dataRows) {
        try {
          // Simple CSV parser that handles quotes
          const values = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          if (!values || values.length < 5) continue;

          const clean = (val: string) => val.replace(/^"|"$/g, '').trim();

          const name = clean(values[0]);
          const barcode = values[1] ? clean(values[1]) : '';
          const category = clean(values[2]);
          const basePrice = Number(clean(values[3]));
          const sellingPrice = Number(clean(values[4]));
          const stock = Number(clean(values[5]));
          const description = values[6] ? clean(values[6]) : '';
          const imageUrl = values[7] ? clean(values[7]) : '';

          if (!name || isNaN(sellingPrice)) {
            errorCount++;
            continue;
          }

          await addDoc(collection(db, 'products'), {
            name,
            barcode,
            category,
            basePrice: basePrice || sellingPrice,
            sellingPrice,
            price: sellingPrice,
            stock,
            description,
            imageUrl,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          importedCount++;
        } catch (err) {
          console.error('Error importing row:', row, err);
          errorCount++;
        }
      }

      alert(`Import selesai! Berhasil: ${importedCount}, Gagal: ${errorCount}`);
      // Reset input
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const headers = ['Nama', 'Barcode', 'Kategori', 'Harga Dasar', 'Harga Jual', 'Stok', 'Deskripsi', 'URL Gambar'];
    const sampleData = [
      ['"Kopi Susu GKL"', '"GKL12345678"', '"Minuman"', 10000, 15000, 100, '"Kopi susu spesial GKL"', '"https://picsum.photos/seed/coffee/200"'],
      ['"Roti Bakar"', '"GKL87654321"', '"Makanan"', 8000, 12000, 50, '"Roti bakar coklat keju"', '"https://picsum.photos/seed/bread/200"']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Template_Import_Produk.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Manajemen Produk</h1>
          <p className="text-gray-500 mt-1 text-sm lg:text-base">Kelola inventaris produk Anda dengan mudah.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="btn-outline flex items-center gap-2"
            title="Unduh Template CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Template
          </button>
          <input
            type="file"
            id="csvImport"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
          <button
            onClick={() => document.getElementById('csvImport')?.click()}
            className="btn-outline flex items-center gap-2"
            title="Import dari CSV"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={handleExportCSV}
            className="btn-outline flex items-center gap-2"
            title="Export ke CSV"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 w-full lg:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
        </div>
      </header>

      <div className="card">
        <div className="card-header">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari produk..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 lg:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Produk</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Barcode</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Kategori</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Harga Dasar</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Harga Jual</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Stok</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{product.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {product.colors?.map((color, idx) => (
                              <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">
                                {color}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.barcode ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {product.barcode}
                          </span>
                          <button 
                            onClick={() => setShowBarcodeModal(product)}
                            className="text-[9px] text-primary font-bold hover:underline flex items-center gap-1"
                          >
                            <BarcodeIcon className="w-3 h-3" />
                            Lihat Barcode
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">No Barcode</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded uppercase tracking-wider">
                        {product.category || 'Umum'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-500 whitespace-nowrap">
                      Rp {(product.basePrice || product.price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 whitespace-nowrap">
                      Rp {(product.sellingPrice || product.price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", product.stock < 10 ? "bg-warning" : "bg-success")} />
                        <span className={cn("text-sm font-bold", product.stock < 10 ? "text-warning" : "text-gray-900")}>
                          {product.stock}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(product)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Produk tidak ditemukan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nama Produk</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Barcode</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Scan atau masukkan barcode"
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={generateBarcode}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-xs font-bold"
                      title="Generate Barcode Otomatis"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Generate
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Harga Dasar (Rp)</label>
                  <input
                    required
                    type="number"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Harga Jual (Rp)</label>
                  <input
                    required
                    type="number"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Stok Awal</label>
                  <input
                    required
                    type="number"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kategori</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">URL Gambar</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="url"
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Deskripsi</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Varian Warna (Pisahkan dengan koma)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Merah, Biru, Hijau"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={formData.colors}
                    onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-2.5 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-2.5 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" />
                  {editingProduct ? 'Perbarui Produk' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Barcode View Modal */}
      {showBarcodeModal && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Barcode Produk</h2>
              <button onClick={() => setShowBarcodeModal(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center gap-6">
              <div ref={printRef} className="bg-white p-6 rounded-lg border border-gray-100 flex flex-col items-center gap-4">
                <p className="text-sm font-bold text-gray-900">{showBarcodeModal.name}</p>
                
                <div className="flex flex-col items-center gap-6">
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Barcode</p>
                    <Barcode 
                      value={showBarcodeModal.barcode || ''} 
                      width={1.5} 
                      height={60} 
                      fontSize={12}
                      background="#ffffff"
                    />
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">QR Code</p>
                    <QRCodeSVG 
                      value={showBarcodeModal.barcode || ''} 
                      size={120}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>

                <p className="text-xs font-bold text-primary mt-2">Rp {showBarcodeModal.sellingPrice.toLocaleString()}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    const printContent = printRef.current;
                    const windowUrl = 'about:blank';
                    const uniqueName = new Date();
                    const windowName = 'Print' + uniqueName.getTime();
                    const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');
                    if (printWindow && printContent) {
                      const barcodeSvg = printContent.querySelector('svg[id^="barcode"]')?.outerHTML || printContent.querySelector('svg')?.outerHTML;
                      const qrSvg = printContent.querySelector('svg:not([id^="barcode"])')?.outerHTML;
                      
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print Barcode & QR</title>
                            <style>
                              body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; }
                              .container { text-align: center; border: 1px solid #eee; padding: 30px; border-radius: 12px; display: flex; flex-direction: column; gap: 20px; align-items: center; }
                              .name { font-weight: bold; margin-bottom: 5px; font-size: 18px; }
                              .price { font-weight: bold; color: #F27D26; font-size: 20px; }
                              .label { font-size: 10px; color: #999; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
                              .section { display: flex; flex-direction: column; align-items: center; }
                            </style>
                          </head>
                          <body>
                            <div class="container">
                              <div class="name">${showBarcodeModal.name}</div>
                              
                              <div class="section">
                                <div class="label">Barcode</div>
                                ${barcodeSvg}
                              </div>
                              
                              <div class="section">
                                <div class="label">QR Code</div>
                                ${qrSvg}
                              </div>

                              <div class="price">Rp ${showBarcodeModal.sellingPrice.toLocaleString()}</div>
                            </div>
                            <script>
                              window.onload = function() { window.print(); window.close(); }
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.focus();
                    }
                  }}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Cetak
                </button>
                <button
                  onClick={() => setShowBarcodeModal(null)}
                  className="flex-1 btn-outline"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
