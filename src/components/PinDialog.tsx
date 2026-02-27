import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

export function PinDialog({ 
  isOpen, 
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (pin === '2453') {
      setPin('');
      setError(false);
      onConfirm();
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
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-center text-primary mb-2">Se requiere PIN</h2>
            <p className="text-sm text-center text-primary/70 mb-6">
              Ingrese el PIN de seguridad para eliminar este registro.
            </p>
            
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              className={`w-full text-center text-2xl tracking-widest p-3 rounded-xl border ${error ? 'border-red-500 bg-red-50' : 'border-primary/20 bg-background'} focus:outline-none focus:ring-2 focus:ring-accent mb-2`}
              placeholder="****"
            />
            {error && <p className="text-red-500 text-sm mb-4">PIN incorrecto</p>}
            
            <div className="flex gap-3 w-full mt-4">
              <button
                onClick={() => {
                  setPin('');
                  setError(false);
                  onClose();
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
