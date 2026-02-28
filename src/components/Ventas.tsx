import { useState, useEffect } from 'react';
import { PRODUCTS, getLocalDateString } from '../constants';
import { SuccessDialog } from './SuccessDialog';
import { PinDialog } from './PinDialog';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

export default function Ventas() {
  const [product, setProduct] = useState(PRODUCTS[0].name);
  const [quantity, setQuantity] = useState(1);
  const [records, setRecords] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const selectedProduct = PRODUCTS.find(p => p.name === product);
  const total = (selectedProduct?.price || 0) * quantity;

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(docs);
    });
    return () => unsubscribe();
  }, []);

  const todayStr = getLocalDateString();
  const todayRecords = records.filter(r => r.date === todayStr);
  const historyRecords = records.filter(r => r.date !== todayStr);

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'sales'), {
        product,
        quantity,
        total,
        date: getLocalDateString(),
        createdAt: Date.now()
      });
      setShowSuccess(true);
      setQuantity(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteDoc(doc(db, 'sales', deleteId));
      setDeleteId(null);
    }
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
            <div className="flex flex-wrap gap-2 mt-3">
              {[5, 10, 15, 20, 25, 18, 90].map(q => (
                <button
                  key={q}
                  onClick={() => setQuantity(q)}
                  className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-bold hover:bg-primary/20 transition-colors text-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-accent/10 rounded-xl flex justify-between items-center">
            <span className="font-bold">Total a cobrar:</span>
            <span className="text-2xl font-bold text-primary">Bs {total}</span>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSubmitting || showSuccess}
            className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Venta'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary">Registros de Hoy</h3>
        <div className="space-y-3">
          {todayRecords.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-primary/10">
              <div>
                <p className="font-bold">{record.product}</p>
                <p className="text-sm text-primary/60">{record.quantity} unidades • {record.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-accent">Bs {record.total}</span>
                <button onClick={() => setDeleteId(record.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {todayRecords.length === 0 && <p className="text-center text-primary/50 py-4">No hay ventas hoy</p>}
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary mt-6">Historial Anterior</h3>
        <div className="space-y-3">
          {historyRecords.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-primary/10 opacity-75">
              <div>
                <p className="font-bold">{record.product}</p>
                <p className="text-sm text-primary/60">{record.quantity} unidades • {record.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-accent">Bs {record.total}</span>
                <button onClick={() => setDeleteId(record.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {historyRecords.length === 0 && <p className="text-center text-primary/50 py-4">No hay historial reciente</p>}
        </div>
      </div>

      <SuccessDialog isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
      <PinDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
