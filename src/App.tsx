/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ReactNode } from 'react';
import { Store, CreditCard, Receipt, PieChart } from 'lucide-react';
import Ventas from './components/Ventas';
import Creditos from './components/Creditos';
import Gastos from './components/Gastos';
import Resumen from './components/Resumen';

export default function App() {
  const [activeTab, setActiveTab] = useState('resumen');

  return (
    <div className="flex flex-col h-screen bg-background text-primary font-sans">
      <header className="bg-[#FDF8F0] shadow-md w-full flex justify-center">
        <img 
          src="https://drive.google.com/thumbnail?id=1wqisPyxDwFjxaAjy37GLDsMhIAwtm1cx&sz=w1200" 
          alt="Banner Panadería LyA" 
          className="w-full max-w-3xl h-auto object-contain"
          referrerPolicy="no-referrer"
        />
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === 'ventas' && <Ventas />}
        {activeTab === 'creditos' && <Creditos />}
        {activeTab === 'gastos' && <Gastos />}
        {activeTab === 'resumen' && <Resumen />}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-primary/20 flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <TabButton 
          icon={<Store />} 
          label="Ventas" 
          isActive={activeTab === 'ventas'} 
          onClick={() => setActiveTab('ventas')} 
        />
        <TabButton 
          icon={<CreditCard />} 
          label="Créditos" 
          isActive={activeTab === 'creditos'} 
          onClick={() => setActiveTab('creditos')} 
        />
        <TabButton 
          icon={<Receipt />} 
          label="Gastos" 
          isActive={activeTab === 'gastos'} 
          onClick={() => setActiveTab('gastos')} 
        />
        <TabButton 
          icon={<PieChart />} 
          label="Resumen" 
          isActive={activeTab === 'resumen'} 
          onClick={() => setActiveTab('resumen')} 
        />
      </nav>
    </div>
  );
}

function TabButton({ icon, label, isActive, onClick }: { icon: ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center p-2 rounded-xl transition-colors ${isActive ? 'text-accent bg-primary/5' : 'text-primary/60 hover:text-primary'}`}
    >
      {icon}
      <span className="text-xs mt-1 font-medium">{label}</span>
    </button>
  );
}
