import { useState, useEffect } from 'react';
import { CATEGORIES, PAYERS } from '../constants';
import { SuccessDialog } from './SuccessDialog';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function Gastos() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [payer, setPayer] = useState(PAYERS[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!description.trim() || !amount) return alert('Complete todos los campos');
    
    await addDoc(collection(db, 'expenses'), {
      description,
      amount: parseFloat(amount),
      category,
      payer: category === 'Material' ? payer : null,
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now()
    });
    setShowSuccess(true);
    setDescription('');
    setAmount('');
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'expenses', id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10">
        <h2 className="text-lg font-bold mb-4 text-primary">Nuevo Gasto</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej. Harina, Luz, Transporte"
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Monto (Bs)</label>
            <input 
              type="number" 
              min="0"
              step="0.1"
              value={amount} 
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categoría</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {category === 'Material' && (
            <div>
              <label className="block text-sm font-medium mb-1">Pagador</label>
              <select 
                value={payer} 
                onChange={e => setPayer(e.target.value)}
                className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {PAYERS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={handleSave}
            className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary/90 transition-colors mt-2"
          >
            Guardar Gasto
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary">Registro de Gastos</h3>
        <div className="space-y-3">
          {records.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-primary/10">
              <div>
                <p className="font-bold">{record.description}</p>
                <div className="flex gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase">
                    {record.category}
                  </span>
                  {record.payer && (
                    <span className="px-2 py-0.5 bg-accent/20 text-accent text-[10px] font-bold rounded-full uppercase">
                      Pagó: {record.payer}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-red-600">-Bs {record.amount}</span>
                <button onClick={() => handleDelete(record.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {records.length === 0 && <p className="text-center text-primary/50 py-4">No hay gastos registrados</p>}
        </div>
      </div>

      <SuccessDialog isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
    </div>
  );
}
