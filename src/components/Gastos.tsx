import { useState, useEffect } from 'react';
import { CATEGORIES, PAYERS, getLocalDateString } from '../constants';
import { SuccessDialog } from './SuccessDialog';
import { PinDialog } from './PinDialog';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

export default function Gastos() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [payer, setPayer] = useState(PAYERS[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(50));
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
    if (!description.trim() || !amount) return alert('Complete todos los campos');
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        description,
        amount: parseFloat(amount),
        category,
        payer: category === 'Material' ? payer : null,
        date: getLocalDateString(),
        createdAt: Date.now()
      });
      setShowSuccess(true);
      setDescription('');
      setAmount('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteDoc(doc(db, 'expenses', deleteId));
      setDeleteId(null);
    }
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
            disabled={isSubmitting || showSuccess}
            className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary/90 transition-colors mt-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Gasto'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary">Gastos de Hoy</h3>
        <div className="space-y-3">
          {todayRecords.map(record => (
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
                <button onClick={() => setDeleteId(record.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {todayRecords.length === 0 && <p className="text-center text-primary/50 py-4">No hay gastos hoy</p>}
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3 text-primary mt-6">Historial Anterior</h3>
        <div className="space-y-3">
          {historyRecords.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-primary/10 opacity-75">
              <div>
                <p className="font-bold">{record.description} <span className="text-xs font-normal text-primary/60 ml-1">({record.date})</span></p>
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
