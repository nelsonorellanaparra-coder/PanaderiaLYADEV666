import { CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function SuccessDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl max-w-sm w-full"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <CheckCircle className="w-32 h-32 text-green-500 mb-6" />
            </motion.div>
            <h2 className="text-2xl font-bold text-center text-primary">¡REGISTRO EXITOSO!</h2>
            <button
              onClick={onClose}
              className="mt-8 bg-primary text-white px-8 py-3 rounded-full font-bold w-full"
            >
              Continuar
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
