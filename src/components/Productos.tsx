import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { PRODUCTS as INITIAL_PRODUCTS } from '../constants';
import { PinDialog } from './PinDialog';
import { SuccessDialog } from './SuccessDialog';
import { Trash2, Plus } from 'lucide-react';

export default function Productos() {
  const [products, setProducts] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [pinAction, setPinAction] = useState<{ type: 'add' | 'delete', id?: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Migrate initial products if empty
    const checkEmpty = async () => {
      const snap = await getDocs(collection(db, 'products'));
      if (snap.empty) {
        for (const p of INITIAL_PRODUCTS) {
          await addDoc(collection(db, 'products'), p);
        }
      }
    };
    checkEmpty();

    return () => unsubscribe();
  }, []);

  const handleAddRequest = () => {
    if (!name.trim() || !price) return alert('Complete los campos');
    setPinAction({ type: 'add' });
  };

  const handleDeleteRequest = (id: string) => {
    setPinAction({ type: 'delete', id });
  };

  const confirmAction = async () => {
    if (!pinAction) return;

    if (pinAction.type === 'add') {
      await addDoc(collection(db, 'products'), {
        name,
        price: parseFloat(price)
      });
      setName('');
      setPrice('');
      setShowSuccess(true);
    } else if (pinAction.type === 'delete' && pinAction.id) {
      await deleteDoc(doc(db, 'products', pinAction.id));
    }
    setPinAction(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10">
        <h2 className="text-lg font-bold mb-4 text-primary">Agregar Nuevo Producto</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre del Producto</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Pan de Batalla"
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Precio Sugerido (Bs)</label>
            <input 
              type="number" 
              step="0.1"
              value={price} 
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button 
            onClick={handleAddRequest}
            className="w-full bg-primary text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Agregar Producto
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary">Lista de Productos</h3>
        <div className="space-y-3">
          {products.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-primary/10">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-primary/60">Precio base: Bs {p.price}</p>
              </div>
              <button 
                onClick={() => handleDeleteRequest(p.id)}
                className="text-red-500 p-2 hover:bg-red-50 rounded-full"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <SuccessDialog isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
      <PinDialog 
        isOpen={!!pinAction} 
        onClose={() => setPinAction(null)} 
        onConfirm={confirmAction} 
      />
    </div>
  );
}
