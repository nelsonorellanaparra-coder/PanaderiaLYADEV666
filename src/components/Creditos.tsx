import { useState, useEffect } from 'react';
import { getLocalDateString } from '../constants';
import { SuccessDialog } from './SuccessDialog';
import { PinDialog } from './PinDialog';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function Creditos() {
  const [products, setProducts] = useState<any[]>([]);
  const [client, setClient] = useState('');
  const [productName, setProductName] = useState('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [records, setRecords] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const pq = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubProducts = onSnapshot(pq, (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setProducts(pData);
      if (pData.length > 0 && !productName) {
        setProductName(pData[0].name);
        setCustomPrice(pData[0].price.toString());
      }
    });

    const q = query(collection(db, 'credits'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubscribe();
      unsubProducts();
    };
  }, []);

  const handleProductChange = (name: string) => {
    setProductName(name);
    const p = products.find(p => p.name === name);
    if (p) {
      setCustomPrice(p.price.toString());
    }
  };

  const total = (parseFloat(customPrice) || 0) * quantity;

  const handleSave = async () => {
    if (!client.trim()) return alert('Ingrese el nombre del cliente');
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'credits'), {
        client,
        product: productName,
        price: parseFloat(customPrice),
        quantity,
        total,
        status: 'Pendiente',
        date: getLocalDateString(),
        createdAt: Date.now()
      });
      setShowSuccess(true);
      setClient('');
      setQuantity(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteDoc(doc(db, 'credits', deleteId));
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10">
        <h2 className="text-lg font-bold mb-4 text-primary">Nuevo Crédito</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <input 
              type="text" 
              value={client} 
              onChange={e => setClient(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Producto</label>
            <select 
              value={productName} 
              onChange={e => handleProductChange(e.target.value)}
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {products.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Precio Unitario (Bs)</label>
            <input 
              type="number" 
              step="0.1"
              value={customPrice} 
              onChange={e => setCustomPrice(e.target.value)}
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
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
            <span className="font-bold">Total Deuda:</span>
            <span className="text-2xl font-bold text-primary">Bs {total}</span>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSubmitting || showSuccess}
            className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Crédito'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary">Deudores</h3>
        <div className="space-y-3">
          {records.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-primary/10">
              <div>
                <p className="font-bold text-lg">{record.client}</p>
                <p className="text-sm text-primary/80">{record.product} (x{record.quantity})</p>
                <span className="inline-block mt-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                  {record.status}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-accent">Bs {record.total}</span>
                <button onClick={() => setDeleteId(record.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {records.length === 0 && <p className="text-center text-primary/50 py-4">No hay créditos registrados</p>}
        </div>
      </div>

      <SuccessDialog isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
      <PinDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
