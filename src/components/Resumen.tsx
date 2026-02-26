import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function Resumen() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState({
    sales: 0,
    credits: 0,
    expenses: 0,
    materials: 0,
    aureliaDebt: 0
  });

  useEffect(() => {
    const qSales = query(collection(db, 'sales'), where('date', '==', date));
    const qCredits = query(collection(db, 'credits'), where('date', '==', date));
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

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-primary/10 flex items-center justify-between">
        <label className="font-bold text-primary">Fecha:</label>
        <input 
          type="date" 
          value={date}
          onChange={e => setDate(e.target.value)}
          className="p-2 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SummaryBox title="Ventas" amount={summary.sales} color="bg-green-100 text-green-800" />
        <SummaryBox title="Créditos" amount={summary.credits} color="bg-blue-100 text-blue-800" />
        <SummaryBox title="Gastos Grales" amount={summary.expenses} color="bg-orange-100 text-orange-800" />
        <SummaryBox title="Materiales" amount={summary.materials} color="bg-red-100 text-red-800" />
      </div>

      <div className="bg-accent/20 p-6 rounded-2xl border border-accent/30 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-primary">Deuda a Sra. Aurelia</h3>
          <p className="text-sm text-primary/70">Por compra de materiales</p>
        </div>
        <span className="text-2xl font-black text-primary">Bs {summary.aureliaDebt}</span>
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
