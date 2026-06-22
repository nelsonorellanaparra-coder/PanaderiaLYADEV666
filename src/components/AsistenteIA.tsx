import { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Loader2, 
  Check, 
  Trash2, 
  Undo2, 
  ArrowRight,
  Store,
  Box,
  Receipt,
  Keyboard,
  Info,
  AlertCircle
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { CATEGORIES, PAYERS, getLocalDateString } from '../constants';

// Removes overlapping word duplication when SpeechRecognition was restarted
function stripOverlap(a: string, b: string): string {
  a = (a || '').trim();
  b = (b || '').trim();
  if (!a) return b;
  if (!b) return a;
  
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  
  let maxOverlapLength = 0;
  const limit = Math.min(wordsA.length, wordsB.length);
  
  for (let len = 1; len <= limit; len++) {
    const suffixA = wordsA.slice(wordsA.length - len).join(' ').toLowerCase();
    const prefixB = wordsB.slice(0, len).join(' ').toLowerCase();
    
    const cleanSuffix = suffixA.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const cleanPrefix = prefixB.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    
    if (cleanSuffix === cleanPrefix) {
      maxOverlapLength = len;
    }
  }
  
  if (maxOverlapLength > 0) {
    const remainingB = wordsB.slice(maxOverlapLength).join(' ');
    return remainingB ? (a + ' ' + remainingB) : a;
  }
  
  return a + ' ' + b;
}

// Deeply collapses and removes consecutive duplicated words
function cleanDuplicatedPhrases(text: string): string {
  if (!text) return '';
  
  let words = text.trim().split(/\s+/);
  if (words.length <= 1) return text;

  let i = 0;
  while (i < words.length) {
    let duplicatedFound = false;
    const maxLen = Math.floor((words.length - i) / 2);
    // Increased scanning threshold from 10 to 100 to detect and eliminate long duplicate segments
    for (let len = Math.min(100, maxLen); len >= 1; len--) {
      const slice1 = words.slice(i, i + len);
      const slice2 = words.slice(i + len, i + 2 * len);
      
      const str1 = slice1.join(' ').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_\`~()]/g, "").trim();
      const str2 = slice2.join(' ').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_\`~()]/g, "").trim();
      
      if (str1 && str1 === str2) {
        words.splice(i + len, len);
        duplicatedFound = true;
        break;
      }
    }
    if (!duplicatedFound) {
      i++;
    }
  }
  
  return words.join(' ');
}

// Drops direct replicate sentences that differ only by whitespace, casing or punctuation
function cleanSentenceDuplications(text: string): string {
  if (!text) return '';
  const sentences = text.split(/([.!?\n]+)/);
  const cleanSentences: string[] = [];
  const seenSentences = new Set<string>();

  for (let i = 0; i < sentences.length; i += 2) {
    const rawSentence = sentences[i];
    const punctuation = sentences[i + 1] || '';
    const clean = rawSentence.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_\`~()]/g, "").trim();
    if (!clean) continue;
    
    let isDuplicated = seenSentences.has(clean);
    if (!isDuplicated) {
      // Check if this sentence is fully covered in a larger sentence already seen
      for (const seen of seenSentences) {
        if (seen.includes(clean) && clean.length > 10) {
          isDuplicated = true;
          break;
        }
      }
    }

    if (!isDuplicated) {
      seenSentences.add(clean);
      cleanSentences.push(rawSentence.trim() + punctuation);
    }
  }
  return cleanSentences.join(' ');
}

// Orchestrator that cleans both phrase-level and sentence-level repetitions
function cleanFullText(text: string): string {
  if (!text) return '';
  // First clean paragraph duplicates, then consecutive duplicates
  return cleanSentenceDuplications(cleanDuplicatedPhrases(text));
}

interface ParsedRecord {
  operationType: 'venta' | 'produccion' | 'gasto';
  product?: string;
  quantity?: number;
  price?: number;
  description?: string;
  amount?: number;
  category?: string;
  payer?: string | null;
}

export default function AsistenteIA() {
  const [products, setProducts] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Review/Verification List
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [savedDocsRef, setSavedDocsRef] = useState<{ id: string; collection: string }[]>([]);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  const currentSessionFinalRef = useRef('');

  // Fetch registered products context
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setProducts(docs);
    });
    return () => unsubscribe();
  }, []);

  // Web Speech API Initialization
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const rec = new SpeechRecognitionAPI();
      rec.lang = 'es-BO';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
        setSaveSuccess(false);
      };

      rec.onresult = (event: any) => {
        let finalSessionText = '';
        let interimSessionText = '';
        for (let i = 0; i < event.results.length; ++i) {
          const segment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalSessionText += (finalSessionText ? ' ' : '') + segment;
          } else {
            interimSessionText += (interimSessionText ? ' ' : '') + segment;
          }
        }
        
        currentSessionFinalRef.current = finalSessionText;
        const accum = accumulatedTranscriptRef.current;
        const rawText = stripOverlap(accum, finalSessionText);
        const fullText = cleanFullText(rawText);
        
        setText(fullText);
        setInterimTranscript(interimSessionText);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('No se concedieron permisos de micrófono. Asegúrate de dar acceso.');
          shouldListenRef.current = false;
          setIsListening(false);
        }
      };

      rec.onend = () => {
        if (shouldListenRef.current) {
          const accum = accumulatedTranscriptRef.current;
          const sessionFinal = currentSessionFinalRef.current;
          const combined = stripOverlap(accum, sessionFinal);
          accumulatedTranscriptRef.current = cleanFullText(combined);
          currentSessionFinalRef.current = '';
          
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
      setError('El dictado de voz no está soportado en este navegador. Utiliza teclado para escribir.');
      return;
    }
    setError(null);
    setSaveSuccess(false);
    accumulatedTranscriptRef.current = text; // continue appending if there's text already
    currentSessionFinalRef.current = '';
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
    setInterimTranscript('');
  };

  // Hit the unified parsing endpoint
  const handleProcessIA = async () => {
    const finalCleanText = cleanFullText(text).trim();
    if (!finalCleanText) {
      setError('Por favor dicta o escribe algo antes de procesar con IA.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/ai/parse-asistente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: finalCleanText,
          products: products,
          categories: CATEGORIES,
          payers: PAYERS
        })
      });

      let errorText = '';
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!res.ok) {
        if (isJson) {
          try {
            const errorData = await res.json();
            errorText = errorData.error || `Error ${res.status}: Falló el procesamiento de IA.`;
          } catch (e) {
            errorText = `Error ${res.status}: Servidor inestable (intente de nuevo).`;
          }
        } else {
          const rawText = await res.text();
          if (res.status === 404) {
            errorText = `Error 404: Ruta de API no encontrada. Asegúrate de que el servidor esté activo.`;
          } else if (res.status === 502 || res.status === 503 || res.status === 504) {
            errorText = `Error de Red (${res.status}): El servidor de IA está temporalmente inaccesible. Por favor, intente de nuevo.`;
          } else {
            errorText = `Error del servidor (${res.status}): Formato de respuesta no soportado.`;
          }
        }
        throw new Error(errorText);
      }

      if (isJson) {
        const data = await res.json();
        const records = data.records || [];
        if (records.length === 0) {
          throw new Error('La IA no pudo clasificar o reconocer ninguna venta, producción o gasto en su dictado. Intente con una frase más estructurada.');
        }
        setParsedRecords(records);
      } else {
        const rawText = await res.text();
        throw new Error(`Error: Formato inesperado del servidor. ${rawText.substring(0, 100)}`);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión con la IA.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Modify individual parsed record in verified view
  const updateParsedRecord = (index: number, updatedFields: Partial<ParsedRecord>) => {
    setParsedRecords(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updatedFields };
      return copy;
    });
  };

  const removeParsedRecord = (index: number) => {
    setParsedRecords(prev => prev.filter((_, i) => i !== index));
  };

  // Save reviewed records to Firestore
  const handleSaveToDatabase = async () => {
    if (parsedRecords.length === 0) return;
    setIsSaving(true);
    setError(null);

    const savedRefs: { id: string; collection: string }[] = [];
    const today = getLocalDateString();

    try {
      for (const record of parsedRecords) {
        if (record.operationType === 'venta') {
          const matchedProd = products.find(p => p.name.toLowerCase() === record.product?.toLowerCase());
          const unitPrice = record.price !== undefined && record.price !== null 
            ? record.price 
            : (matchedProd ? matchedProd.price : 0);
          
          const qty = record.quantity || 0;
          const totalAmount = qty * unitPrice;

          const docRef = await addDoc(collection(db, 'sales'), {
            product: record.product || 'Sin nombre',
            quantity: qty,
            price: unitPrice,
            total: totalAmount,
            date: today,
            createdAt: Date.now()
          });
          savedRefs.push({ id: docRef.id, collection: 'sales' });

        } else if (record.operationType === 'produccion') {
          const docRef = await addDoc(collection(db, 'production'), {
            product: record.product || 'Sin nombre',
            quantity: record.quantity || 0,
            date: today,
            createdAt: Date.now()
          });
          savedRefs.push({ id: docRef.id, collection: 'production' });

        } else if (record.operationType === 'gasto') {
          const categoryName = record.category || 'Gasto General';
          const payerName = categoryName === 'Material' ? record.payer : null;

          const docRef = await addDoc(collection(db, 'expenses'), {
            description: record.description || 'Gasto sin descripción',
            amount: record.amount || 0,
            category: categoryName,
            payer: payerName || null,
            date: today,
            createdAt: Date.now()
          });
          savedRefs.push({ id: docRef.id, collection: 'expenses' });
        }
      }

      setSavedCount(parsedRecords.length);
      setSavedDocsRef(savedRefs);
      setSaveSuccess(true);
      setParsedRecords([]);
      setText(''); // clear input text on success
    } catch (saveErr: any) {
      setError('Fallo al guardar algunos registros en la base de datos: ' + saveErr.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Undo operation
  const handleUndoSave = async () => {
    if (savedDocsRef.length === 0) return;
    setIsSaving(true);
    try {
      for (const item of savedDocsRef) {
        await deleteDoc(doc(db, item.collection, item.id));
      }
      setSavedDocsRef([]);
      setSaveSuccess(false);
      setError('Operación deshecha: Todos los registros guardados han sido borrados de la Base de Datos.');
    } catch (err: any) {
      setError('No se pudo deshacer la operación: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="bg-[#FAF6F0] p-6 sm:p-8 rounded-3xl border border-[#E8DFC8]">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="text-accent animate-pulse shrink-0" size={28} />
          <h1 className="text-xl sm:text-2xl font-bold text-primary">Asistente Unificado de IA</h1>
        </div>
        <p className="text-sm text-primary/70 leading-relaxed max-w-2xl">
          Escribe o dicta cualquier actividad utilizando tu voz o teclado de manera libre. 
          Nuestra Inteligencia Artificial clasificará, limpiará ortografía, extraerá datos y catalogará tus 
          <span className="font-bold text-primary"> Ventas</span>, <span className="font-semibold text-orange-600"> Producción</span> y <span className="font-semibold text-red-600"> Gastos</span> automáticamente en una sola acción.
        </p>
      </div>

      {/* Main Unified Input Panel */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-primary/10 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <Keyboard size={18} className="text-primary/60" />
            <span>Panel de Dictado y Escritura Directa</span>
          </h2>
          {isListening && (
            <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              🎤 ESCUCHANDO VOZ...
            </span>
          )}
        </div>

        {/* Big editable Text Area combining typing and dictation */}
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isProcessing || isSaving}
            placeholder='Escribe o dicta de manera natural... Ej: "Hoy hemos vendido 20 empanadas a Bs 3.5 y 3 queques. También horneamos 40 rollos grandes. Luego pagué 120Bs en harina comprada por Lesly."'
            className="w-full min-h-[140px] p-5 pb-16 border border-primary/20 bg-background rounded-2xl block text-sm focus:ring-2 focus:ring-accent focus:outline-none leading-relaxed transition-all resize-y text-primary font-medium"
          />
          {interimTranscript && (
            <div className="absolute left-5 right-5 bottom-12 text-xs italic text-primary/40 bg-white/80 py-1 px-2 rounded backdrop-blur-sm pointer-events-none">
              {interimTranscript}...
            </div>
          )}
          
          <div className="absolute right-3 bottom-3 flex gap-2">
            {text.trim() && (
              <button
                type="button"
                onClick={() => setText('')}
                className="p-2 text-primary/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Limpiar texto"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={isListening ? stopListening : startListening}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 text-white ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-bounce' 
                  : 'bg-accent hover:bg-accent/90'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff size={14} /> Stop / Detener
                </>
              ) : (
                <>
                  <Mic size={14} /> {text ? 'Agregar por Voz' : 'Dictar por Voz'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Processing State */}
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-6 bg-primary/5 rounded-2xl border border-primary/15 animate-pulse space-y-3">
            <Loader2 size={32} className="text-accent animate-spin" />
            <div className="text-center">
              <p className="text-sm font-bold text-primary">La IA está procesando tu dictado...</p>
              <p className="text-xs text-primary/50">Estructurando, categorizando elementos y revisando el listado...</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={handleProcessIA}
              disabled={!text.trim() || isListening}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-orange-500 text-white font-bold px-6 py-3.5 rounded-2xl hover:brightness-105 active:scale-98 transition-all disabled:opacity-40 text-sm"
            >
              <Sparkles size={16} className="animate-spin" style={{ animationDuration: '4s' }} />
              Procesar Dictado con IA
            </button>
          </div>
        )}
      </div>

      {/* Full screen backdrop loader to block user interaction completely */}
      {isProcessing && (
        <div className="fixed inset-0 bg-primary/45 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-[#E8DFC8]/50 animate-in fade-in zoom-in duration-200">
            <div className="relative flex justify-center mb-6">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl scale-125 animate-pulse" />
              <div className="relative bg-gradient-to-tr from-accent to-orange-500 text-white p-5 rounded-full shadow-lg">
                <Loader2 size={40} className="animate-spin" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-primary mb-2">Procesando con Inteligencia Artificial</h3>
            <p className="text-sm text-primary/70 leading-relaxed mb-4">
              Por favor espera, la Inteligencia Artificial está analizando tu dictado, corrigiendo ortografía y estructurando la información...
            </p>
            <div className="text-[10px] font-mono text-accent uppercase tracking-wider bg-accent/5 py-1.5 px-3 rounded-full inline-block">
              Clasificando ventas, producción y gastos
            </div>
          </div>
        </div>
      )}

      {/* Error Alert Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-3xl flex gap-3 text-xs md:text-sm shadow-sm">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold">Retroalimentación del Asistente</p>
            <p className="text-red-700/80 leading-relaxed mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Success Alert with Undo Option */}
      {saveSuccess && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="bg-green-500 text-white p-2.5 rounded-full shrink-0 shadow-sm">
              <Check size={22} className="animate-bounce" />
            </div>
            <div>
              <p className="font-bold text-green-900">¡Registros almacenados perfectamente!</p>
              <p className="text-sm text-green-700/90 leading-relaxed mt-0.5">
                Se han guardado de forma exitosa <span className="font-bold text-green-800">{savedCount} registros</span> en las correspondientes planillas de Ventas, Producción y Gastos de hoy.
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleUndoSave}
              disabled={isSaving}
              className="flex items-center gap-2 text-xs font-bold text-red-600 bg-white border border-red-200 px-4 py-2.5 rounded-xl hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
            >
              <Undo2 size={14} />
              Deshacer / Borrar de la Base de Datos
            </button>
          </div>
        </div>
      )}

      {/* Review Stage Panel - Critical for corrections before final commit */}
      {parsedRecords.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-primary/10 space-y-6">
          <div className="border-b border-primary/5 pb-4 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <Check className="text-green-500" size={20} />
                <span>Revisión y Confirmación</span>
              </h3>
              <p className="text-xs text-primary/50 mt-0.5">La IA interpretó lo siguiente. Puedes modificar los datos si hay algún error antes de guardar.</p>
            </div>
            <button
              onClick={() => setParsedRecords([])}
              className="text-xs text-primary/50 hover:text-red-500 font-bold"
            >
              Cancelar revisión
            </button>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {parsedRecords.map((record, index) => {
              const isSale = record.operationType === 'venta';
              const isProd = record.operationType === 'produccion';
              const isGasto = record.operationType === 'gasto';

              return (
                <div 
                  key={index} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSale 
                      ? 'bg-blue-50/40 border-blue-100' 
                      : isProd 
                        ? 'bg-orange-50/40 border-orange-100' 
                        : 'bg-red-50/40 border-red-100'
                  }`}
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        isSale 
                          ? 'bg-blue-500 text-white' 
                          : isProd 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-red-500 text-white'
                      }`}>
                        {isSale && 'VENTA'}
                        {isProd && 'PRODUCCIÓN'}
                        {isGasto && 'GASTO'}
                      </span>
                      {isSale && <Store size={15} className="text-blue-500" />}
                      {isProd && <Box size={15} className="text-orange-500" />}
                      {isGasto && <Receipt size={15} className="text-red-500" />}
                    </div>

                    {/* Inline Inputs for perfect correction capability */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Name or Description */}
                      {(isSale || isProd) ? (
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-primary/40 uppercase mb-1">Producto</label>
                          <select
                            value={record.product || ''}
                            onChange={(e) => updateParsedRecord(index, { product: e.target.value })}
                            className="w-full text-xs p-2 bg-white border border-primary/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-accent font-medium text-primary"
                          >
                            <option value="">Seleccione producto...</option>
                            {products.map((p, pIdx) => (
                              <option key={pIdx} value={p.name}>{p.name}</option>
                            ))}
                            {!products.find(p => p.name.toLowerCase() === record.product?.toLowerCase()) && record.product && (
                              <option value={record.product}>{record.product} (Nuevo)</option>
                            )}
                          </select>
                        </div>
                      ) : (
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-primary/40 uppercase mb-1">Detalle del Gasto</label>
                          <input
                            type="text"
                            value={record.description || ''}
                            onChange={(e) => updateParsedRecord(index, { description: e.target.value })}
                            className="w-full text-xs p-2 bg-white border border-primary/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-accent font-semibold text-primary"
                          />
                        </div>
                      )}

                      {/* Numeric fields */}
                      {(isSale || isProd) ? (
                        <div>
                          <label className="block text-[10px] font-bold text-primary/40 uppercase mb-1">Cantidad</label>
                          <input
                            type="number"
                            value={record.quantity || ''}
                            onChange={(e) => updateParsedRecord(index, { quantity: parseInt(e.target.value) || 0 })}
                            className="w-full text-xs p-2 bg-white border border-primary/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-accent font-bold"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-bold text-primary/40 uppercase mb-1">Monto (Bs.)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={record.amount || ''}
                            onChange={(e) => updateParsedRecord(index, { amount: parseFloat(e.target.value) || 0 })}
                            className="w-full text-xs p-2 bg-white border border-primary/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-accent font-bold text-red-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* Secondary details per item type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {isSale && (
                        <div>
                          <label className="block text-[10px] font-bold text-[#2A65CA]/60 uppercase mb-1">Precio Unitario (Bs.)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={record.price !== undefined ? record.price : ''}
                            placeholder={(products.find(p => p.name === record.product)?.price || '0').toString()}
                            onChange={(e) => updateParsedRecord(index, { price: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                            className="w-full text-xs p-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                          />
                        </div>
                      )}

                      {isGasto && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-[#CA2A2A]/60 uppercase mb-1">Categoría</label>
                            <select
                              value={record.category || 'Gasto General'}
                              onChange={(e) => updateParsedRecord(index, { category: e.target.value })}
                              className="w-full text-xs p-2 bg-white border border-red-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
                            >
                              {CATEGORIES.map((cat, catIdx) => (
                                <option key={catIdx} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          {record.category === 'Material' && (
                            <div>
                              <label className="block text-[10px] font-bold text-[#CA2A2A]/60 uppercase mb-1">Pagador</label>
                              <select
                                value={record.payer || ''}
                                onChange={(e) => updateParsedRecord(index, { payer: e.target.value })}
                                className="w-full text-xs p-2 bg-white border border-red-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
                              >
                                <option value="">Seleccione pagador...</option>
                                {PAYERS.map((payer, payIdx) => (
                                  <option key={payIdx} value={payer}>{payer}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Remove row trigger */}
                  <div className="flex md:flex-col justify-end items-center">
                    <button
                      onClick={() => removeParsedRecord(index)}
                      className="p-2 text-primary/30 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Eliminar este registro"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 border-t border-primary/5 pt-4">
            <button
              onClick={() => setParsedRecords([])}
              className="flex-1 py-3 text-primary/60 border border-primary/10 rounded-2xl hover:bg-background active:scale-95 transition-all text-sm font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              className="flex-2 py-3 text-white bg-green-600 hover:bg-green-700 active:scale-95 transition-all rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando en la planilla...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Guardar Todos los Registros ({parsedRecords.length})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Examples & Guidance Card to prevent un-formatted voice stress */}
      <div className="bg-[#FAF9F6] border border-primary/5 rounded-3xl p-6">
        <h4 className="font-bold text-xs text-primary/60 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Info size={14} className="text-secondary" />
          Ejemplos recomendados para dictar o escribir:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-xl border border-primary/5">
            <p className="font-bold text-blue-800 mb-1">Dictado de Ventas</p>
            <p className="italic text-primary/60 leading-relaxed">"Hola, hoy hemos vendido 15 queques a precio diario, y también 50 empanadas normales."</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-primary/5">
            <p className="font-bold text-orange-700 mb-1">Ventas + Producción</p>
            <p className="italic text-primary/60 leading-relaxed">"Hoy vendí 5 empanadas integrales a bolivianos 4, y horneamos 100 queques en total."</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-primary/5">
            <p className="font-bold text-red-700 mb-1">Todo Mezclado con Gastos</p>
            <p className="italic text-primary/60 leading-relaxed">"Hoy vendimos 2 rollos pequeños, y he gastado 40 bolivianos en levadura de Lesly."</p>
          </div>
        </div>
      </div>
    </div>
  );
}
