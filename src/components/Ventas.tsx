import { useState, useEffect } from 'react';
import { PRODUCTS } from '../constants';
import { SuccessDialog } from './SuccessDialog';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

export default function Ventas() {
  const [product, setProduct] = useState(PRODUCTS[0].name);
  const [quantity, setQuantity] = useState(1);
  const [records, setRecords] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedProduct = PRODUCTS.find(p => p.name === product);
  const total = (selectedProduct?.price || 0) * quantity;

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    await addDoc(collection(db, 'sales'), {
      product,
      quantity,
      total,
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now()
    });
    setShowSuccess(true);
    setQuantity(1);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'sales', id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10">
        <h2 className="text-lg font-bold mb-4 text-primary">Nueva Venta</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Producto</label>
            <select 
              value={product} 
              onChange={e => setProduct(e.target.value)}
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {PRODUCTS.map(p => (
                <option key={p.name} value={p.name}>{p.name} (Bs {p.price})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cantidad</label>
            <input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="p-4 bg-accent/10 rounded-xl flex justify-between items-center">
            <span className="font-bold">Total a cobrar:</span>
            <span className="text-2xl font-bold text-primary">Bs {total}</span>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            Guardar Venta
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary">Últimos Registros</h3>
        <div className="space-y-3">
          {records.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-primary/10">
              <div>
                <p className="font-bold">{record.product}</p>
                <p className="text-sm text-primary/60">{record.quantity} unidades • {record.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-accent">Bs {record.total}</span>
                <button onClick={() => handleDelete(record.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {records.length === 0 && <p className="text-center text-primary/50 py-4">No hay ventas recientes</p>}
        </div>
      </div>

      <SuccessDialog isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
    </div>
  );
}
