/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, ReactNode, useEffect } from 'react';
import { Store, CreditCard, Receipt, PieChart, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { PRODUCTS as INITIAL_PRODUCTS } from './constants';
import Ventas from './components/Ventas';
import Creditos from './components/Creditos';
import Gastos from './components/Gastos';
import Resumen from './components/Resumen';
import Productos from './components/Productos';

const TABS = ['ventas', 'creditos', 'gastos', 'resumen', 'productos'];

const DIRECT_LINKS: { [key: string]: string } = {
  'empanadaintegral': 'https://i.ibb.co/x8hyNmPy/Screenshot-1.png',
  'empanadasabs35': 'https://i.ibb.co/Mkq6QrM3/Empanadas.png',
  'queques': 'https://i.ibb.co/60589T4N/qq.png',
  'rollosgrandes': 'https://i.ibb.co/nMgnXyTN/Rollos-de-queso-AI.png',
  'rollospequenos': 'https://i.ibb.co/DPLzNnhm/1234124.png',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const runMigration = async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        const normalize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const batch: Promise<any>[] = [];

        if (snap.empty) {
          for (const p of INITIAL_PRODUCTS) {
            const normName = normalize(p.name);
            batch.push(addDoc(collection(db, 'products'), {
              ...p,
              imageUrl: DIRECT_LINKS[normName] || p.imageUrl
            }));
          }
        } else {
          for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const name = data.name || '';
            const currentUrl = data.imageUrl || '';
            const normName = normalize(name);
            const correctUrl = DIRECT_LINKS[normName];

            if (correctUrl && (currentUrl !== correctUrl || currentUrl.includes('unsplash.com'))) {
              batch.push(updateDoc(doc(db, 'products', docSnap.id), {
                imageUrl: correctUrl
              }));
            }
          }
        }
        if (batch.length > 0) {
          await Promise.all(batch);
        }
      } catch (err) {
        console.error('Migration error:', err);
      }
    };
    runMigration();
  }, []);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);

  const handleTabChange = (tab: string) => {
    const newIndex = TABS.indexOf(tab);
    const currentIndex = TABS.indexOf(activeTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(tab);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > 50;
    const isRightSwipe = distanceX < -50;

    // Only trigger swipe if horizontal movement is greater than vertical (prevents triggering on scroll)
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > 50) {
      const currentIndex = TABS.indexOf(activeTab);
      if (isLeftSwipe && currentIndex < TABS.length - 1) {
        setDirection(1);
        setActiveTab(TABS[currentIndex + 1]);
      } else if (isRightSwipe && currentIndex > 0) {
        setDirection(-1);
        setActiveTab(TABS[currentIndex - 1]);
      }
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-primary font-sans overflow-hidden">
      <header className="bg-[#FDF8F0] shadow-md w-full flex justify-center shrink-0 z-10 relative">
        <img 
          src="https://drive.google.com/thumbnail?id=1wqisPyxDwFjxaAjy37GLDsMhIAwtm1cx&sz=w1200" 
          alt="Banner Panadería LyA" 
          className="w-full max-w-3xl h-auto object-contain"
          referrerPolicy="no-referrer"
        />
      </header>
      
      <main 
        className="flex-1 relative overflow-hidden bg-background"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="absolute inset-0 overflow-y-auto p-4 pb-24"
          >
            {activeTab === 'ventas' && <Ventas />}
            {activeTab === 'creditos' && <Creditos />}
            {activeTab === 'gastos' && <Gastos />}
            {activeTab === 'resumen' && <Resumen />}
            {activeTab === 'productos' && <Productos />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-primary/20 flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
        <TabButton 
          icon={<Store />} 
          label="Ventas" 
          isActive={activeTab === 'ventas'} 
          onClick={() => handleTabChange('ventas')} 
        />
        <TabButton 
          icon={<CreditCard />} 
          label="Créditos" 
          isActive={activeTab === 'creditos'} 
          onClick={() => handleTabChange('creditos')} 
        />
        <TabButton 
          icon={<Receipt />} 
          label="Gastos" 
          isActive={activeTab === 'gastos'} 
          onClick={() => handleTabChange('gastos')} 
        />
        <TabButton 
          icon={<PieChart />} 
          label="Resumen" 
          isActive={activeTab === 'resumen'} 
          onClick={() => handleTabChange('resumen')} 
        />
        <TabButton 
          icon={<Package />} 
          label="Productos" 
          isActive={activeTab === 'productos'} 
          onClick={() => handleTabChange('productos')} 
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
