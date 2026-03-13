import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar } from 'lucide-react';

export function EditDateDialog({ 
  isOpen, 
  onClose, 
  onConfirm,
  currentDate
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (newDate: string) => void;
  currentDate: string;
}) {
  const [pin, setPin] = useState('');
  const [date, setDate] = useState(currentDate);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDate(currentDate);
      setPin('');
      setError(false);
    }
  }, [isOpen, currentDate]);

  const handleConfirm = () => {
    if (pin === '2453') {
      setPin('');
      setError(false);
      onConfirm(date);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl p-6 flex flex-col items-center shadow-2xl max-w-sm w-full"
          >
            <Calendar className="w-16 h-16 text-primary mb-4" />
            <h2 className="text-xl font-bold text-center text-primary mb-2">Cambiar Fecha</h2>
            <p className="text-sm text-center text-primary/70 mb-4">
              Seleccione la nueva fecha e ingrese el PIN para confirmar.
            </p>
            
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 rounded-xl border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-accent mb-4 font-medium"
            />

            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              className={`w-full text-center text-2xl tracking-widest p-3 rounded-xl border ${error ? 'border-red-500 bg-red-50' : 'border-primary/20 bg-background'} focus:outline-none focus:ring-2 focus:ring-accent mb-2`}
              placeholder="PIN ****"
            />
            {error && <p className="text-red-500 text-sm mb-4">PIN incorrecto</p>}
            
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-primary text-white py-3 rounded-xl font-bold"
              >
                Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
