import { useState, useEffect } from 'react';
import { CATEGORIES, PAYERS, getLocalDateString } from '../constants';
import { SuccessDialog } from './SuccessDialog';
import { PinDialog } from './PinDialog';
import { Trash2, Search } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { VoiceInput } from './VoiceInput';

export default function Gastos() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [payer, setPayer] = useState(PAYERS[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(docs);
    });
    return () => unsubscribe();
  }, []);

  const todayStr = getLocalDateString();
  
  const filteredRecords = records.filter(r => 
    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.payer && r.payer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const todayRecords = filteredRecords.filter(r => r.date === todayStr);
  const historyRecords = filteredRecords.filter(r => r.date !== todayStr);

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

  const handleSaveVoiceEntries = async (entries: any[]) => {
    const savedDocs: any[] = [];
    const today = getLocalDateString();
    for (const exp of entries) {
      const data = {
        description: exp.description,
        amount: exp.amount,
        category: exp.category,
        payer: exp.category === 'Material' ? exp.payer : null,
        date: today,
        createdAt: Date.now()
      };
      
      const docRef = await addDoc(collection(db, 'expenses'), data);
      savedDocs.push({ id: docRef.id, ...data });
    }
    return savedDocs;
  };

  const handleDeleteVoiceEntries = async (entries: any[]) => {
    for (const entry of entries) {
      await deleteDoc(doc(db, 'expenses', entry.id));
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
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-primary">Nuevo Gasto</h2>
          <VoiceInput
            mode="gastos"
            categoriesContext={CATEGORIES}
            payersContext={PAYERS}
            onSaveEntries={handleSaveVoiceEntries}
            onDeleteEntries={handleDeleteVoiceEntries}
            onSuccess={() => {}}
          />
        </div>
        
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
        <input 
          type="text" 
          placeholder="Buscar en gastos..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-primary/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent text-sm"
        />
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
