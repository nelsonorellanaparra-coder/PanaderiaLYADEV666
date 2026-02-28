import { useState, useEffect } from 'react';
import { getLocalDateString } from '../constants';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const getWeekDates = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diffToMonday));
  
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return days.map((day, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return {
      name: day,
      value: `${year}-${month}-${date}`
    };
  });
};

export default function Resumen() {
  const [date, setDate] = useState(getLocalDateString());
  const [summary, setSummary] = useState({
    sales: 0,
    credits: 0,
    expenses: 0,
    materials: 0,
    aureliaDebt: 0
  });

  useEffect(() => {
    const qSales = query(collection(db, 'sales'), where('date', '==', date));
    const qCredits = query(collection(db, 'credits')); // Mostrar todos los créditos históricos
    const qExpenses = query(collection(db, 'expenses'), where('date', '==', date));

    let salesTotal = 0;
    let creditsTotal = 0;
    let expensesTotal = 0;
    let materialsTotal = 0;
    let aureliaDebt = 0;

    const updateSummary = () => {
      setSummary({
        sales: salesTotal,
        credits: creditsTotal,
        expenses: expensesTotal,
        materials: materialsTotal,
        aureliaDebt: aureliaDebt
      });
    };

    const unsubSales = onSnapshot(qSales, (snap) => {
      salesTotal = snap.docs.reduce((acc, doc) => acc + (doc.data().total || 0), 0);
      updateSummary();
    });

    const unsubCredits = onSnapshot(qCredits, (snap) => {
      creditsTotal = snap.docs.reduce((acc, doc) => acc + (doc.data().total || 0), 0);
      updateSummary();
    });

    const unsubExpenses = onSnapshot(qExpenses, (snap) => {
      let exp = 0;
      let mat = 0;
      let aur = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.category === 'Gasto General') exp += data.amount || 0;
        if (data.category === 'Material') {
          mat += data.amount || 0;
          if (data.payer === 'Sra. Aurelia') aur += data.amount || 0;
        }
      });
      expensesTotal = exp;
      materialsTotal = mat;
      aureliaDebt = aur;
      updateSummary();
    });

    return () => {
      unsubSales();
      unsubCredits();
      unsubExpenses();
    };
  }, [date]);

  const realProfit = summary.sales - (summary.expenses + summary.materials);
  const weekDays = getWeekDates();

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-primary/10 space-y-4">
        <div className="flex justify-between gap-1 overflow-x-auto pb-2">
          {weekDays.map(day => (
            <button
              key={day.value}
              onClick={() => setDate(day.value)}
              className={`flex-1 min-w-[40px] py-2 rounded-xl text-sm font-bold transition-colors ${
                date === day.value 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-primary/5 text-primary/70 hover:bg-primary/10'
              }`}
            >
              {day.name}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-primary/10 pt-4">
          <label className="font-bold text-primary">Fecha específica:</label>
          <input 
            type="date" 
            value={date}
            onChange={e => setDate(e.target.value)}
            className="p-2 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SummaryBox title="Ventas" amount={summary.sales} color="bg-green-100 text-green-800" />
        <SummaryBox title="Créditos" amount={summary.credits} color="bg-blue-100 text-blue-800" />
        <SummaryBox title="Gastos Generales" amount={summary.expenses} color="bg-orange-100 text-orange-800" />
        <SummaryBox title="Materiales" amount={summary.materials} color="bg-red-100 text-red-800" />
      </div>

      <div className="bg-primary p-8 rounded-3xl shadow-lg text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/20 rounded-full -ml-8 -mb-8 blur-xl"></div>
        
        <h2 className="text-lg font-medium text-white/80 mb-2 relative z-10">Ganancia Real del Día</h2>
        <p className="text-5xl font-black tracking-tight relative z-10">
          Bs {realProfit}
        </p>
        <p className="text-sm text-white/60 mt-4 relative z-10">
          Ventas - (Gastos + Materiales)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-primary/10 text-center">
          <h3 className="text-sm font-bold text-primary/60 mb-1">Lesly 60%</h3>
          <p className="text-2xl font-black text-primary">Bs {Number.isInteger(realProfit * 0.6) ? (realProfit * 0.6) : (realProfit * 0.6).toFixed(1)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-primary/10 text-center">
          <h3 className="text-sm font-bold text-primary/60 mb-1">Nelson 40%</h3>
          <p className="text-2xl font-black text-primary">Bs {Number.isInteger(realProfit * 0.4) ? (realProfit * 0.4) : (realProfit * 0.4).toFixed(1)}</p>
        </div>
      </div>

      <div className="bg-accent/20 p-6 rounded-2xl border border-accent/30 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-primary">Deuda a Sra. Aurelia</h3>
          <p className="text-sm text-primary/70">Por compra de materiales</p>
        </div>
        <span className="text-2xl font-black text-primary">Bs {summary.aureliaDebt}</span>
      </div>
    </div>
  );
}

function SummaryBox({ title, amount, color }: { title: string, amount: number, color: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-primary/10 flex flex-col items-center justify-center text-center">
      <span className="text-sm font-bold text-primary/60 mb-1">{title}</span>
      <span className={`text-xl font-black px-3 py-1 rounded-lg ${color}`}>
        Bs {amount}
      </span>
    </div>
  );
}
