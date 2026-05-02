import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Star, 
  CreditCard, 
  Smartphone, 
  ChevronRight, 
  X,
  CheckCircle2,
  Package,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Camera,
  AlertCircle
} from 'lucide-react';

import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, query, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  rating: number;
  image: string;
  mechanicId?: string;
  mechanicName?: string;
  description?: string;
  year?: string;
  carType?: string;
  manufacturer?: string;
  condition?: 'new' | 'used' | 'refurbished';
  contactNumber?: string;
  isApproved?: boolean;
}

export default function ShopModule({ userId, role }: { userId: string, role?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCart, setShowCart] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'payment' | 'success'>('cart');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [newPart, setNewPart] = useState<Partial<Product>>({
    name: '',
    price: 0,
    category: 'Engine',
    description: '',
    year: '',
    carType: '',
    manufacturer: '',
    condition: 'new',
    contactNumber: ''
  });

  const fetchProducts = async () => {
    try {
      const q = role === 'mechanic' 
        ? query(collection(db, "products"), where("mechanicId", "==", userId))
        : query(collection(db, "products"));
        
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
    } catch (err) {
      console.error("Fetch Products Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [userId, role]);

  const handleSavePart = async () => {
    setIsProcessing(true);
    try {
      if (editingItem) {
        await updateDoc(doc(db, "products", editingItem.id), {
          ...newPart,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "products"), {
          ...newPart,
          mechanicId: userId,
          rating: 4.5,
          image: `https://picsum.photos/seed/${newPart.name}/400/400`, // Placeholder for now
          isApproved: false,
          createdAt: serverTimestamp()
        });
      }
      setShowAddModal(false);
      setEditingItem(null);
      setNewPart({ name: '', price: 0, category: 'Engine', condition: 'new' });
      fetchProducts();
    } catch (err) {
      console.error("Save Part Error:", err);
      alert("Failed to save part. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePart = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
      await deleteDoc(doc(db, "products", productId));
      fetchProducts();
    } catch (err) {
      console.error("Delete Part Error:", err);
    }
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      // Create order directly from client
      const sellerIds = [...new Set(cart.map(item => item.product.mechanicId).filter(Boolean))];
      
      const orderData = {
        userId,
        sellerIds, // Track which mechanics sold items in this order
        items: cart.map(item => ({ 
          id: item.product.id, 
          name: item.product.name, 
          price: item.product.price, 
          qty: item.quantity,
          mechanicId: item.product.mechanicId
        })),
        totalAmount: total,
        paymentMethod: 'credit_card',
        status: "pending",
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "orders"), orderData);
      setCheckoutStep('success');
    } catch (err) {
      console.error("Checkout Error:", err);
      alert("Checkout failed. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const categories = ['All', 'Engine', 'Tires', 'Electrical', 'Brakes', 'Oil'];

  const filteredProducts = activeCategory === 'All' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? {...item, quantity: item.quantity + 1} : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-20">
        <h1 className="text-xl font-bold text-slate-900">{role === 'mechanic' ? 'My Inventory' : 'Auto Shop'}</h1>
        <div className="flex gap-2">
          {role === 'mechanic' ? (
            <button 
              onClick={() => {
                setEditingItem(null);
                setNewPart({ name: '', price: 0, category: 'Engine', condition: 'new' });
                setShowAddModal(true);
              }}
              className="bg-brand-blue text-white p-2 px-4 rounded-xl flex items-center gap-2 font-bold text-sm shadow-lg shadow-brand-blue/20 active:scale-95 transition-all"
            >
              <Plus size={18} />
              Add Part
            </button>
          ) : (
            <button 
              onClick={() => {
                setShowCart(true);
                setCheckoutStep('cart');
              }}
              className="bg-brand-blue/5 p-2 rounded-xl text-brand-blue relative"
            >
              <ShoppingCart size={24} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white rounded-2xl p-4 flex items-center gap-3 border border-slate-100 shadow-sm">
            <Search size={20} className="text-slate-400" />
            <input type="text" placeholder="Search parts..." className="bg-transparent border-none outline-none text-sm w-full" />
          </div>
          <button className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-slate-400">
            <Filter size={20} />
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                activeCategory === cat ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20' : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-3xl p-4 border border-slate-50 shadow-sm flex flex-col gap-3 group"
            >
              <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden relative">
                 <img 
                    src={product.image} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    alt={product.name}
                    referrerPolicy="no-referrer"
                 />
                 {role === 'mechanic' ? (
                   <div className="absolute top-2 right-2 flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setEditingItem(product);
                          setNewPart(product);
                          setShowAddModal(true);
                        }}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-xl text-brand-blue shadow-lg active:scale-95 transition-transform"
                      >
                         <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeletePart(product.id)}
                        className="bg-red-500 text-white p-2 rounded-xl shadow-lg active:scale-95 transition-transform"
                      >
                         <Trash2 size={16} />
                      </button>
                   </div>
                 ) : (
                   <button 
                     onClick={() => addToCart(product)}
                     className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded-xl text-brand-blue shadow-lg active:scale-95 transition-transform"
                   >
                     <ShoppingCart size={18} />
                   </button>
                 )}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Star size={10} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-[10px] font-bold text-slate-400">{product.rating}</span>
                  <span className="mx-1 text-slate-200">|</span>
                  <span className="text-[8px] font-bold text-brand-blue uppercase tracking-tighter">By {product.mechanicName || 'Top Mechanic'}</span>
                  {role === 'mechanic' && (
                    <span className={`ml-auto text-[8px] font-bold px-2 py-0.5 rounded-full ${product.isApproved ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                      {product.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{product.name}</h3>
                <p className="text-brand-blue font-black text-lg">${product.price.toFixed(2)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-[40px] z-[110] shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   {checkoutStep !== 'cart' && (
                     <button onClick={() => setCheckoutStep('cart')} className="text-slate-400">
                        <ArrowLeft size={24} />
                     </button>
                   )}
                   <h2 className="text-xl font-bold text-slate-900">
                     {checkoutStep === 'cart' && 'My Cart'}
                     {checkoutStep === 'payment' && 'Checkout'}
                     {checkoutStep === 'success' && 'Order Placed!'}
                   </h2>
                 </div>
                 <button onClick={() => setShowCart(false)} className="text-slate-400 hover:bg-slate-50 p-2 rounded-full">
                    <X size={24} />
                 </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {checkoutStep === 'cart' && (
                    <motion.div 
                      key="cart"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      {cart.length === 0 ? (
                        <div className="text-center py-20 space-y-4">
                           <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-slate-300">
                              <Package size={40} />
                           </div>
                           <p className="text-slate-400 font-medium tracking-tight">Your cart is empty</p>
                        </div>
                      ) : (
                        cart.map((item) => (
                          <div key={item.product.id} className="flex gap-4 items-center">
                            <img src={item.product.image} className="w-16 h-16 rounded-2xl object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                               <h4 className="font-bold text-sm">{item.product.name}</h4>
                               <p className="text-brand-blue font-bold text-xs">${item.product.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                               <button 
                                 onClick={() => {
                                   if (item.quantity > 1) {
                                     setCart(cart.map(i => i.product.id === item.product.id ? {...i, quantity: i.quantity - 1} : i));
                                   } else {
                                     setCart(cart.filter(i => i.product.id !== item.product.id));
                                   }
                                 }}
                                 className="w-8 h-8 flex items-center justify-center font-bold text-slate-400"
                               >
                                 -
                               </button>
                               <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                               <button 
                                 onClick={() => setCart(cart.map(i => i.product.id === item.product.id ? {...i, quantity: i.quantity + 1} : i))}
                                 className="w-8 h-8 flex items-center justify-center font-bold text-brand-blue"
                               >
                                 +
                               </button>
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}

                  {checkoutStep === 'payment' && (
                    <motion.div 
                      key="payment"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                        <div className="space-y-4">
                           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select Payment Method</h3>
                           <div className="space-y-3">
                              <button className="w-full border-2 border-brand-blue bg-blue-50 p-5 rounded-3xl flex items-center justify-between relative overflow-hidden">
                                 <div className="flex items-center gap-4">
                                    <div className="bg-brand-blue text-white p-2 rounded-xl">
                                       <CreditCard size={24} />
                                    </div>
                                    <div className="text-left">
                                       <p className="font-bold">Credit / Debit Card</p>
                                       <p className="text-xs text-slate-500">Stripe Secure Payment</p>
                                    </div>
                                 </div>
                                 <div className="absolute top-0 right-0 bg-brand-blue text-white text-[8px] font-bold px-2 py-1 rounded-bl-lg">COMING SOON</div>
                                 <CheckCircle2 className="text-brand-blue" />
                              </button>
                              <button className="w-full border-2 border-slate-100 p-5 rounded-3xl flex items-center justify-between opacity-60 relative overflow-hidden grayscale">
                                 <div className="flex items-center gap-4">
                                    <div className="bg-green-500 text-white p-2 rounded-xl">
                                       <Smartphone size={24} />
                                    </div>
                                    <div className="text-left">
                                       <p className="font-bold">M-PESA Utility</p>
                                       <p className="text-xs text-slate-500">Direct Mobile Payment</p>
                                    </div>
                                 </div>
                                 <div className="absolute top-0 right-0 bg-slate-400 text-white text-[8px] font-bold px-2 py-1 rounded-bl-lg">COMING SOON</div>
                              </button>
                           </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                           <div className="flex justify-between text-slate-500 text-sm">
                              <span>Subtotal</span>
                              <span>${total.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between text-slate-500 text-sm">
                              <span>Shipping</span>
                              <span className="text-green-500 font-bold">FREE</span>
                           </div>
                           <div className="pt-3 border-t border-slate-200 flex justify-between font-black text-lg">
                              <span>Total</span>
                              <span className="text-brand-blue">${total.toFixed(2)}</span>
                           </div>
                        </div>
                    </motion.div>
                  )}

                  {checkoutStep === 'success' && (
                    <motion.div 
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12 space-y-6"
                    >
                       <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-green-500 relative">
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                          >
                             <CheckCircle2 size={64} />
                          </motion.div>
                          <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>
                       </div>
                       <div className="space-y-2">
                          <h3 className="text-2xl font-black">Success!</h3>
                          <p className="text-slate-400 font-medium">Your order has been placed and will be delivered shortly.</p>
                       </div>
                       <button 
                         onClick={() => {
                           setCart([]);
                           setShowCart(false);
                         }}
                         className="bg-brand-blue text-white w-full py-4 rounded-2xl font-bold shadow-xl shadow-brand-blue/20"
                       >
                         Continue Shopping
                       </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Drawer Footer */}
              {cart.length > 0 && checkoutStep !== 'success' && (
                <div className="p-6 bg-white border-t border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                       <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Estimated Total</span>
                       <span className="text-2xl font-black text-brand-blue">${total.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={() => {
                        if (checkoutStep === 'cart') setCheckoutStep('payment');
                        else handleCheckout();
                      }}
                      disabled={isProcessing}
                      className="w-full bg-slate-900 text-white py-5 rounded-3xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>
                          {checkoutStep === 'cart' ? 'Proceed to Checkout' : 'Pay Now'}
                          <ChevronRight size={20} />
                        </>
                      )}
                    </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Add/Edit Part Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowAddModal(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-white w-full max-w-md rounded-[48px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
             >
                <div className="flex justify-between items-center mb-8">
                   <h2 className="text-2xl font-black">{editingItem ? 'Edit Product' : 'Add Spare Part'}</h2>
                   <button onClick={() => setShowAddModal(false)} className="bg-slate-50 p-2 rounded-full text-slate-400">
                      <X size={24} />
                   </button>
                </div>

                <div className="space-y-6">
                   {/* Photo Upload Placeholder */}
                   <div className="aspect-video bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 group hover:bg-blue-50/50 hover:border-brand-blue/30 transition-all">
                      <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                        <Camera size={32} className="text-brand-blue" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Product Image</p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Part Name</label>
                        <input 
                          value={newPart.name}
                          onChange={e => setNewPart({...newPart, name: e.target.value})}
                          placeholder="e.g. Brake Pads"
                          className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-brand-blue/20 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Price ($)</label>
                        <input 
                          type="number"
                          value={newPart.price}
                          onChange={e => setNewPart({...newPart, price: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-brand-blue/20 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                        <select 
                          value={newPart.category}
                          onChange={e => setNewPart({...newPart, category: e.target.value})}
                          className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-brand-blue/20 transition-all text-sm"
                        >
                          {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Car Type</label>
                        <input 
                           value={newPart.carType}
                           onChange={e => setNewPart({...newPart, carType: e.target.value})}
                           placeholder="e.g. Toyota Vitz"
                           className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-brand-blue/20 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Condition</label>
                        <select 
                          value={newPart.condition}
                          onChange={e => setNewPart({...newPart, condition: e.target.value as any})}
                          className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-brand-blue/20 transition-all text-sm"
                        >
                          <option value="new">Brand New</option>
                          <option value="used">Used</option>
                          <option value="refurbished">Refurbished</option>
                        </select>
                      </div>
                   </div>

                   <button 
                     onClick={handleSavePart}
                     disabled={isProcessing || !newPart.name}
                     className="w-full bg-brand-blue text-white py-5 rounded-3xl font-bold shadow-xl shadow-brand-blue/20 active:scale-95 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                   >
                     {isProcessing ? <Loader2 className="animate-spin" size={20} /> : (editingItem ? 'Update Listing' : 'Publish to Shop')}
                   </button>
                   {!editingItem && (
                     <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest">Part will be visible to users after admin approval</p>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
