import { useState, useEffect } from 'react';
import { getLocalDateString } from '../constants';
import { SuccessDialog } from './SuccessDialog';
import { PinDialog } from './PinDialog';
import { EditDateDialog } from './EditDateDialog';
import { Trash2, Edit2, ClipboardList, ShoppingCart, Box } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';

export default function Ventas() {
  const [products, setProducts] = useState<any[]>([]);
  const [productName, setProductName] = useState('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [records, setRecords] = useState<any[]>([]);
  const [productionRecords, setProductionRecords] = useState<any[]>([]);
  const [mode, setMode] = useState<'venta' | 'produccion'>('venta');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<{id: string, coll: string} | null>(null);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  useEffect(() => {
    const pq = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubProducts = onSnapshot(pq, (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(pData);
      if (pData.length > 0 && !productName) {
        setProductName(pData[0].name);
        setCustomPrice(pData[0].price.toString());
      }
    });

    const sq = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100));
    const unsubSales = onSnapshot(sq, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const prq = query(collection(db, 'production'), orderBy('createdAt', 'desc'), limit(100));
    const unsubProd = onSnapshot(prq, (snapshot) => {
      setProductionRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubProd();
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
  const todayStr = getLocalDateString();

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const collectionName = mode === 'venta' ? 'sales' : 'production';
      const data: any = {
        product: productName,
        quantity,
        date: todayStr,
        createdAt: Date.now()
      };
      
      if (mode === 'venta') {
        data.price = parseFloat(customPrice);
        data.total = total;
      }

      await addDoc(collection(db, collectionName), data);
      setShowSuccess(true);
      setQuantity(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmAction = async () => {
    if (deleteId) {
      await deleteDoc(doc(db, deleteId.coll, deleteId.id));
      setDeleteId(null);
    }
  };

  const confirmEditDate = async (newDate: string) => {
    if (editingRecord) {
      const coll = editingRecord.total !== undefined ? 'sales' : 'production';
      await updateDoc(doc(db, coll, editingRecord.id), { date: newDate });
      setEditingRecord(null);
    }
  };

  // Cálculo de Inventario
  const inventorySummary = products.map(p => {
    const producedToday = productionRecords
      .filter(r => r.product === p.name && r.date === todayStr)
      .reduce((sum, r) => sum + r.quantity, 0);
    
    const soldToday = records
      .filter(r => r.product === p.name && r.date === todayStr)
      .reduce((sum, r) => sum + r.quantity, 0);

    return { name: p.name, produced: producedToday, sold: soldToday, balance: producedToday - soldToday };
  });

  return (
    <div className="space-y-6">
      {/* Selector de Modo */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-primary/10">
        <button 
          onClick={() => setMode('venta')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${mode === 'venta' ? 'bg-primary text-white' : 'text-primary/60'}`}
        >
          <ShoppingCart size={20} /> Ventas
        </button>
        <button 
          onClick={() => setMode('produccion')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${mode === 'produccion' ? 'bg-orange-600 text-white' : 'text-primary/60'}`}
        >
          <ClipboardList size={20} /> Producción
        </button>
      </div>

      {/* Formulario Dinámico */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10">
        <h2 className="text-lg font-bold mb-4 text-primary">
          {mode === 'venta' ? 'Registrar Nueva Venta' : 'Registrar Producción Diaria'}
        </h2>
        
        <div className="space-y-4">
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

          {mode === 'venta' && (
            <div>
              <label className="block text-sm font-medium mb-1">Precio Unitario (Bs)</label>
              <input 
                type="number" step="0.1"
                value={customPrice} 
                onChange={e => setCustomPrice(e.target.value)}
                className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Cantidad {mode === 'produccion' ? 'Producida' : ''}</label>
            <input 
              type="number" min="1" 
              value={quantity} 
              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {mode === 'venta' && (
            <div className="p-4 bg-accent/10 rounded-xl flex justify-between items-center">
              <span className="font-bold">Total a cobrar:</span>
              <span className="text-2xl font-bold text-primary">Bs {total}</span>
            </div>
          )}

          <button 
            onClick={handleSave}
            disabled={isSubmitting || showSuccess}
            className={`w-full p-4 rounded-xl font-bold text-white transition-colors disabled:opacity-50 ${mode === 'venta' ? 'bg-primary hover:bg-primary/90' : 'bg-orange-600 hover:bg-orange-700'}`}
          >
            {isSubmitting ? 'Guardando...' : `Guardar ${mode === 'venta' ? 'Venta' : 'Producción'}`}
          </button>
        </div>
      </div>

      {/* Resumen de Inventario Hoy */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10">
        <div className="flex items-center gap-2 mb-4">
          <Box className="text-primary" size={20} />
          <h3 className="font-bold text-primary">Inventario de Hoy</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {inventorySummary.filter(i => i.produced > 0 || i.sold > 0).map(item => (
            <div key={item.name} className="flex justify-between items-center p-3 bg-background rounded-xl border border-primary/5">
              <span className="font-bold text-sm">{item.name}</span>
              <div className="flex gap-4 text-xs">
                <div className="text-center">
                  <p className="text-gray-400">Prod.</p>
                  <p className="font-bold text-orange-600">{item.produced}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400">Vend.</p>
                  <p className="font-bold text-green-600">{item.sold}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400">Saldo</p>
                  <p className={`font-bold ${item.balance < 0 ? 'text-red-500' : 'text-primary'}`}>{item.balance}</p>
                </div>
              </div>
            </div>
          ))}
          {inventorySummary.every(i => i.produced === 0 && i.sold === 0) && (
            <p className="text-center text-sm text-primary/40 py-2">Sin actividad registrada hoy</p>
          )}
        </div>
      </div>

      {/* Listados */}
      <div className="space-y-6">
        <div>
          <h3 className="font-bold mb-3 text-primary">Actividad de Hoy</h3>
          <div className="space-y-3">
            {[...records, ...productionRecords]
              .filter(r => r.date === todayStr)
              .sort((a, b) => b.createdAt - a.createdAt)
              .map(record => (
                <div key={record.id} className={`bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border ${record.total !== undefined ? 'border-primary/10' : 'border-orange-200 bg-orange-50/30'}`}>
                  <div>
                    <p className="font-bold flex items-center gap-2">
                      {record.total !== undefined ? <ShoppingCart size={14} className="text-primary" /> : <ClipboardList size={14} className="text-orange-600" />}
                      {record.product}
                    </p>
                    <p className="text-sm text-primary/60">{record.quantity} unidades • {record.total !== undefined ? 'Venta' : 'Producción'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.total !== undefined && <span className="font-bold text-accent mr-2 text-sm">Bs {record.total}</span>}
                    <button onClick={() => setEditingRecord(record)} className="text-blue-500 p-2 hover:bg-blue-50 rounded-full">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setDeleteId({id: record.id, coll: record.total !== undefined ? 'sales' : 'production'})} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <SuccessDialog isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
      <PinDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmAction} />
      <EditDateDialog 
        isOpen={!!editingRecord} 
        currentDate={editingRecord?.date || ''} 
        onClose={() => setEditingRecord(null)} 
        onConfirm={confirmEditDate} 
      />
    </div>
  );
}
