import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Package, 
  Tag, 
  Truck, 
  X, 
  Camera, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Hash,
  Info
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

interface ShopSellerToolsProps {
  userId: string;
  onClose: () => void;
}

export default function ShopSellerTools({ userId, onClose }: ShopSellerToolsProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Engine',
    year: '',
    carType: '',
    manufacturer: '',
    condition: 'new' as 'new' | 'used' | 'refurbished',
    contactNumber: '',
    image: '',
    stock: 1
  });

  useEffect(() => {
    const q = query(
      collection(db, "products"),
      where("mechanicId", "==", userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        mechanicId: userId,
        isApproved: true, // Auto-approved
        updatedAt: serverTimestamp(),
        createdAt: editingId ? undefined : serverTimestamp(),
        rating: 0
      };

      if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
      } else {
        await addDoc(collection(db, "products"), productData);
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData({
        name: '', description: '', price: '', category: 'Engine',
        year: '', carType: '', manufacturer: '', condition: 'new',
        contactNumber: '', image: '', stock: 1
      });
    } catch (err) {
      console.error("Save Product Error:", err);
      alert("Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category,
      year: product.year || '',
      carType: product.carType || '',
      manufacturer: product.manufacturer || '',
      condition: product.condition || 'new',
      contactNumber: product.contactNumber || '',
      image: product.image || '',
      stock: product.stock || 1
    });
    setEditingId(product.id);
    setIsAdding(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Limit 5MB.");
      return;
    }

    setIsUploading(true);
    console.log("Starting product image upload:", file.name);
    try {
      const uploadData = new FormData();
      uploadData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData
      });

      if (!response.ok) {
        let errorMessage = "Product upload failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const textError = await response.text();
          errorMessage = textError || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Product upload successful:", result.imageUrl);
      setFormData(prev => ({ ...prev, image: result.imageUrl }));
    } catch (err: any) {
      console.error("Upload error detail:", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white px-6 py-6 flex items-center justify-between border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
           <button onClick={onClose} className="bg-slate-50 p-2 rounded-xl text-slate-400">
              <X size={24} />
           </button>
           <h1 className="text-xl font-black tracking-tight text-slate-900">Inventory Management</h1>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
          }}
          className="bg-brand-blue text-white p-3 rounded-2xl shadow-lg shadow-brand-blue/20 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
             <Loader2 className="animate-spin text-brand-blue" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 space-y-4">
             <div className="bg-slate-100 w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto text-slate-300">
                <Package size={48} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800">No Listings Yet</h3>
                <p className="text-slate-400 text-sm max-w-[200px] mx-auto">Start listing your spare parts in the marketplace.</p>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-[32px] p-5 border border-slate-100 shadow-sm flex items-center gap-5 group">
                <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">
                   <img src={product.image || "https://picsum.photos/seed/part/100/100"} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border
                        ${product.isApproved ? 'bg-green-50 text-green-600 border-green-100' : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'}
                      `}>
                         {product.isApproved ? 'Retail Ready' : 'Active Listing'}
                      </span>
                      <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">{product.category}</span>
                   </div>
                   <h4 className="font-bold text-slate-800 tracking-tight leading-none mb-1">{product.name}</h4>
                   <p className="text-brand-blue font-black tracking-tighter">${product.price.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => handleEdit(product)}
                     className="bg-slate-50 p-3 rounded-2xl text-slate-400 hover:bg-brand-blue hover:text-white transition-all shadow-sm active:scale-95"
                   >
                     <Edit3 size={18} />
                   </button>
                   <button 
                     onClick={() => handleDelete(product.id)}
                     className="bg-red-50 p-3 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                   >
                     <Trash2 size={18} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 top-12 bg-white rounded-t-[48px] z-[120] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editingId ? 'Edit Listing' : 'Submit New Part'}</h2>
                   <p className="text-slate-400 text-sm font-medium">Detailed specs for car owners</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="bg-slate-50 p-3 rounded-2xl text-slate-400">
                   <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                 <div className="space-y-6">
                    <div className="flex items-center gap-3 text-brand-blue mb-2 px-1">
                       <Info size={18} />
                       <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Core Identity</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                       <label className="space-y-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Part Name</span>
                          <input 
                            required
                            className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                            placeholder="e.g. Brake Pads D-Series"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                          />
                       </label>

                       <div className="grid grid-cols-2 gap-4">
                          <label className="space-y-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Retail Price ($)</span>
                             <input 
                               required
                               type="number"
                               className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                               placeholder="0.00"
                               value={formData.price}
                               onChange={e => setFormData({...formData, price: e.target.value})}
                             />
                          </label>
                          <label className="space-y-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</span>
                             <select 
                               className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                               value={formData.category}
                               onChange={e => setFormData({...formData, category: e.target.value})}
                             >
                               {['Engine', 'Tires', 'Electrical', 'Brakes', 'Oil'].map(c => (
                                 <option key={c} value={c}>{c}</option>
                               ))}
                             </select>
                          </label>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-brand-blue mb-2 px-1">
                       <Truck size={18} />
                       <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Vehicle Compatibility</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <label className="space-y-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Manufacturer</span>
                          <input 
                            className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                            placeholder="Toyota, BMW..."
                            value={formData.manufacturer}
                            onChange={e => setFormData({...formData, manufacturer: e.target.value})}
                          />
                       </label>
                       <label className="space-y-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Year</span>
                          <input 
                            className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                            placeholder="2018-2022"
                            value={formData.year}
                            onChange={e => setFormData({...formData, year: e.target.value})}
                          />
                       </label>
                    </div>

                    <label className="space-y-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Car Model/Type</span>
                       <input 
                         className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                         placeholder="Camry, X5, Sedan..."
                         value={formData.carType}
                         onChange={e => setFormData({...formData, carType: e.target.value})}
                       />
                    </label>
                 </div>

                 <div className="space-y-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-brand-blue mb-2 px-1">
                       <Tag size={18} />
                       <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Condition & Logistics</h3>
                    </div>

                    <div className="flex gap-2">
                       {['new', 'used', 'refurbished'].map(cond => (
                         <button
                           key={cond}
                           type="button"
                           onClick={() => setFormData({...formData, condition: cond as any})}
                           className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all
                             ${formData.condition === cond 
                               ? 'bg-blue-50 border-brand-blue text-brand-blue' 
                               : 'bg-white border-slate-100 text-slate-400'}
                           `}
                         >
                           {cond}
                         </button>
                       ))}
                    </div>

                    <label className="space-y-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Number</span>
                       <input 
                         className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                         placeholder="+254..."
                         value={formData.contactNumber}
                         onChange={e => setFormData({...formData, contactNumber: e.target.value})}
                       />
                    </label>

                    <label className="space-y-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photo Reference</span>
                       <div className="flex gap-4 items-start">
                          <div className="flex-1 space-y-2">
                             <input 
                               className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-800 border-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                               placeholder="Image URL appears here..."
                               value={formData.image}
                               onChange={e => setFormData({...formData, image: e.target.value})}
                             />
                             {formData.image && (
                               <div className="relative group w-full aspect-video rounded-2xl overflow-hidden shadow-inner border border-slate-100">
                                  <img 
                                    src={formData.image} 
                                    className="w-full h-full object-cover" 
                                    alt="Preview" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                                    className="absolute top-2 right-2 bg-white/80 backdrop-blur-md p-2 rounded-xl text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                     <Trash2 size={16} />
                                  </button>
                               </div>
                             )}
                          </div>
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-slate-100 w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 hover:bg-slate-200 transition-colors"
                          >
                             {isUploading ? <Loader2 size={24} className="animate-spin text-brand-blue" /> : <Camera size={24} />}
                          </button>
                          <input 
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                       </div>
                    </label>
                 </div>

                 <div className="p-4 bg-yellow-50 rounded-3xl flex gap-4 items-start border border-yellow-100">
                    <AlertCircle className="text-yellow-600 mt-1 flex-shrink-0" size={20} />
                    <div>
                       <h4 className="font-bold text-yellow-800 text-sm">Regulatory Notice</h4>
                       <p className="text-[10px] text-yellow-700/60 leading-tight">All marketplace listings must comply with Mechora community guidelines. Products are visible instantly but monitored for safety.</p>
                    </div>
                 </div>

                 <button 
                   disabled={isSaving}
                   className="w-full bg-brand-blue text-white py-6 rounded-[32px] font-black shadow-2xl shadow-brand-blue/30 active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
                 >
                    {isSaving ? <Loader2 className="animate-spin" size={24} /> : (
                      <>
                        <CheckCircle2 size={24} />
                        {editingId ? 'Confirm Update' : 'Publish Product'}
                      </>
                    )}
                 </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
