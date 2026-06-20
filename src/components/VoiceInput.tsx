import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Loader2, X, AlertCircle, Check, Trash2, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceInputProps {
  mode: 'ventas' | 'gastos';
  productsContext?: any[]; // Only for ventas
  categoriesContext?: string[]; // Only for gastos
  payersContext?: string[]; // Only for gastos
  onSuccess: (savedEntries: any[]) => void;
  onSaveEntries: (entries: any[]) => Promise<any[]>; // callback to save to Firestore and return stored docs
  onDeleteEntries: (entries: any[]) => Promise<void>; // callback to delete saved entries (for undo)
}

export function VoiceInput({
  mode,
  productsContext = [],
  categoriesContext = [],
  payersContext = [],
  onSuccess,
  onSaveEntries,
  onDeleteEntries
}: VoiceInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Undo/Confirmation State
  const [processedEntries, setProcessedEntries] = useState<any[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const pulseTimerRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const rec = new SpeechRecognitionAPI();
      rec.lang = 'es-BO'; // Spanish (Bolivia/LatAm)
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) {
          setTranscript(prev => prev + ' ' + final);
        }
        setInterimTranscript(interim);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('No se concedieron permisos de micrófono. Asegúrate de dar acceso.');
          shouldListenRef.current = false;
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Keep listening and don't stop
        } else {
          // Other transient errors, can log
        }
      };

      rec.onend = () => {
        // If the user intends to still be recording, auto-restart the speech API
        if (shouldListenRef.current) {
          try {
            rec.start();
          } catch (e) {
            console.warn('Microphone auto-restart retry...', e);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      setError('El dictado de voz no está soportado en este navegador. Revisa el soporte para Web Speech API.');
      return;
    }
    setTranscript('');
    setInterimTranscript('');
    setProcessedEntries([]);
    setSaveSuccess(false);
    setError(null);
    shouldListenRef.current = true;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  };

  const stopListening = () => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTranscript('');
    setInterimTranscript('');
    setProcessedEntries([]);
    setSaveSuccess(false);
    setError(null);
    setIsProcessing(false);
    // Auto-start listening after modal opens
    setTimeout(() => {
      startListening();
    }, 400);
  };

  const handleClose = () => {
    stopListening();
    setIsOpen(false);
  };

  const handleProcessText = async (textToProcess: string) => {
    const finalCleanText = textToProcess.trim();
    if (!finalCleanText) {
      setError('Por favor diga o escriba algo para procesar.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    stopListening();

    try {
      const endpoint = mode === 'ventas' ? '/api/ai/parse-ventas' : '/api/ai/parse-gastos';
      const bodyPayload = mode === 'ventas' 
        ? { text: finalCleanText, products: productsContext } 
        : { text: finalCleanText, categories: categoriesContext, payers: payersContext };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al procesar dictado.');
      }

      const aiResponse = await res.json();
      const extractedItems = mode === 'ventas' ? aiResponse.transactions : aiResponse.expenses;
      
      if (!extractedItems || extractedItems.length === 0) {
        throw new Error('La IA no pudo reconocer transacciones claras en su mensaje. Intente de nuevo con frases más precisas, ej: "He vendido 5 empanadas" o "gasté 40 Bs en huevos".');
      }

      // Save entries directly to Database as requested!
      const saved = await onSaveEntries(extractedItems);
      setProcessedEntries(saved);
      setSaveSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error en comunicación con la IA.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = async () => {
    if (processedEntries.length === 0) return;
    try {
      await onDeleteEntries(processedEntries);
      setProcessedEntries([]);
      setSaveSuccess(false);
      setTranscript('');
      setError('Registros eliminados. Puede volver a dictar.');
      startListening();
    } catch (e: any) {
      setError('No se pudo deshacer la operación: ' + e.message);
    }
  };

  return (
    <>
      {/* Mic Trigger Button */}
      <button
        onClick={handleOpen}
        id={`voice-btn-${mode}`}
        className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-4 sm:py-2.5 sm:px-4 bg-gradient-to-r from-accent to-orange-500 text-white rounded-2xl sm:rounded-xl font-bold shadow-md hover:from-accent/90 hover:to-orange-400 active:scale-95 transition-all text-sm sm:text-xs"
      >
        <Sparkles size={16} className="animate-pulse shrink-0" />
        <span>Dictar con IA</span>
        <Mic size={16} className="shrink-0" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-primary/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-primary/10"
            >
              <div className="p-6 border-b border-primary/5 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles size={18} className="text-accent animate-spin" style={{ animationDuration: '3s' }} />
                  <h3 className="font-bold text-base">Asistente por Voz de IA ({mode === 'ventas' ? 'Ventas' : 'Gastos'})</h3>
                </div>
                <button onClick={handleClose} className="p-1 rounded-full hover:bg-black/5 transition-colors">
                  <X size={20} className="text-primary/60" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Listening & Soundwave Animation */}
                {!saveSuccess && !isProcessing && (
                  <div className="flex flex-col items-center justify-center py-4 space-y-4">
                    <div className="relative">
                      {isListening && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
                          <span className="absolute -inset-4 rounded-full bg-accent/15 animate-pulse" />
                        </>
                      )}
                      <button
                        onClick={isListening ? stopListening : startListening}
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-white transition-all shadow-md z-10 relative ${isListening ? 'bg-red-500 scale-105' : 'bg-accent hover:bg-accent/90'}`}
                      >
                        {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                      </button>
                    </div>

                    <p className={`text-xs font-bold transition-colors ${isListening ? 'text-red-500 blink animate-pulse' : 'text-primary/60'}`}>
                      {isListening ? '🎤 Escuchando... hable ahora' : 'Micrófono apagado. Presione para dictar'}
                    </p>

                    <div className="text-center bg-background p-4 rounded-2xl w-full border border-primary/5 min-h-[90px] relative flex flex-col justify-center">
                      {(transcript || interimTranscript) ? (
                        <p className="text-sm text-primary/80 leading-relaxed font-medium">
                          {transcript}
                          <span className="text-primary/40 italic">{interimTranscript}</span>
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-primary/40 italic">"He vendido 15 queques a 15 de precio diario" o "He producido 30 rollos pequeños"</p>
                          <p className="text-[10px] text-primary/30 uppercase tracking-wider font-bold">Ejemplo de entrada</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Processing Spinner */}
                {isProcessing && (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <Loader2 size={42} className="text-accent animate-spin" />
                    <div className="text-center space-y-1">
                      <p className="font-bold text-primary">Procesando Dictado con IA...</p>
                      <p className="text-xs text-primary/50">La IA lee, corrige ortografía y guarda los registros automáticamente...</p>
                    </div>
                  </div>
                )}

                {/* AI Success Confirmation */}
                {saveSuccess && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-green-50 text-green-800 p-4 rounded-2xl border border-green-200">
                      <div className="bg-green-500 text-white p-2 rounded-full shadow-inner animate-bounce">
                        <Check size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">¡Guardado con Éxito mediante Voz!</p>
                        <p className="text-xs text-green-700/80">Los datos se han procesado y guardado automáticamente en la base de datos.</p>
                      </div>
                    </div>

                    <div className="bg-background border border-primary/5 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold text-primary/40 uppercase tracking-wider">Registros Agregados:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {processedEntries.map((entry, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm p-2 bg-white rounded-lg border border-primary/5">
                            <div className="flex items-center gap-2">
                              {mode === 'ventas' ? (
                                <span className={`w-2 h-2 rounded-full ${entry.type === 'venta' ? 'bg-primary' : 'bg-orange-500'}`} />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                              )}
                              <div>
                                <p className="font-bold text-xs">{mode === 'ventas' ? entry.product : entry.description}</p>
                                <p className="text-[10px] text-primary/50">
                                  {mode === 'ventas' 
                                    ? `${entry.quantity} unidades • ${entry.type === 'venta' ? 'Venta' : 'Producción'}`
                                    : `${entry.category} ${entry.payer ? '• Pagó: ' + entry.payer : ''}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold text-xs ${mode === 'ventas' ? 'text-accent' : 'text-red-500'}`}>
                                {mode === 'ventas' 
                                  ? (entry.type === 'venta' ? `Bs ${entry.total}` : '-')
                                  : `Bs ${entry.amount}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleUndo}
                        className="flex-1 p-3 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                      >
                        <Undo2 size={16} /> Deshacer / Borrar todo
                      </button>
                      <button
                        onClick={handleClose}
                        className="flex-1 p-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/95 active:scale-95 transition-all text-xs"
                      >
                        Listo, terminar
                      </button>
                    </div>
                  </div>
                )}

                {/* Error Panel */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex gap-3 text-xs">
                    <AlertCircle className="text-red-500 shrink-0" size={18} />
                    <div>
                      <p className="font-bold">Aviso del Asistente</p>
                      <p className="text-red-700/80 leading-relaxed mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {/* Action controls when transcribing */}
                {!saveSuccess && !isProcessing && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 p-3 rounded-xl border border-primary/10 text-primary/60 hover:bg-background active:scale-95 transition-all text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    
                    {isListening ? (
                      <button
                        onClick={() => handleProcessText(transcript + ' ' + interimTranscript)}
                        disabled={!(transcript.trim() || interimTranscript.trim())}
                        className="flex-1 p-3 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-50 active:scale-95 transition-all text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Sparkles size={14} /> Procesar con IA
                      </button>
                    ) : (
                      <button
                        onClick={() => handleProcessText(transcript)}
                        disabled={!transcript.trim()}
                        className="flex-1 p-3 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-50 active:scale-95 transition-all text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Sparkles size={14} /> Procesar con IA
                      </button>
                    )}
                  </div>
                )}

                {/* Fallback Keyboard Input for accessibility */}
                {!saveSuccess && !isProcessing && (
                  <div className="pt-4 border-t border-primary/5 space-y-2">
                    <details className="group">
                      <summary className="text-[10px] text-primary/40 hover:text-primary/60 font-medium cursor-pointer list-none flex items-center justify-center gap-1">
                        <span>⌨️ ¿Problemas con el micrófono? Escribir dictado</span>
                      </summary>
                      <div className="pt-2 flex gap-2">
                        <input
                          type="text"
                          placeholder="Ej: He vendido 10 queques y 3 rollos pequeños"
                          value={transcript}
                          onChange={(e) => setTranscript(e.target.value)}
                          className="flex-1 p-2 border border-primary/20 rounded-xl bg-background text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleProcessText(transcript);
                          }}
                        />
                        <button
                          onClick={() => handleProcessText(transcript)}
                          className="bg-accent text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-accent/90"
                        >
                          Procesar
                        </button>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
