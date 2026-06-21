import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to retry Gemini content generation on transient failures (like 503 Service Unavailable or 429 Rate Limits)
// Implements an automatic model fallback list to route around overloaded model endpoints seamlessly.
async function generateWithRetry(ai: GoogleGenAI, options: any) {
  const modelsToTry = [
    options.model || "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  
  // Deduplicate preserving order
  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: any = null;

  for (const model of uniqueModels) {
    try {
      console.log(`[Gemini API] intentando generación con modelo: "${model}"`);
      const currentOptions = { ...options, model };
      return await ai.models.generateContent(currentOptions);
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      console.warn(`[Gemini API] El modelo "${model}" falló. Detalle: ${errMsg}. Cambiando inmediatamente al siguiente modelo alternativo...`);
    }
  }
  
  throw lastError || new Error("Todos los modelos de Gemini disponibles fallaron.");
}

const app = express();
app.use(express.json());

// API Route for parsing sales/production voice content
app.post("/api/ai/parse-ventas", async (req, res) => {
  try {
    const { text, products } = req.body;
    if (!text) {
      return res.status(400).json({ error: "El texto es requerido" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "API Key de Gemini no configurada. Por favor, agregue GEMINI_API_KEY en Panel lateral > Settings > Secrets." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const productsContext = products && products.length > 0 
      ? `Productos de la panadería disponibles:\n${products.map((p: any) => `- Name: "${p.name}", Normal price: ${p.price}`).join('\n')}`
      : 'Productos de la panadería sugeridos:\n- "Empanada Integral"\n- "Empanadas a Bs.3.5"\n- "Queques"\n- "Rollos grandes"\n- "Rollos pequeños"';

    const prompt = `Analiza la transcripción de voz de un panadero y extrae todas las transacciones de venta o producción mencionadas. El usuario puede dictar múltiples registros a la vez (por ejemplo: "hoy se ha producido 20 queques y 100 empanadas" o "vendido 50 queques y producido 20 empanadas"). Extrae cada una de ellas como un objeto individual en la lista "transactions".
Texto del dictado del usuario: "${text}"

${productsContext}

Reglas importantes de correspondencia de productos:
1. Mapea el producto mencionado con el nombre exacto de la lista de productos disponibles proporcionada.
2. Si el usuario dice "queques" o similar, mapea a "Queques" exactamente.
3. Si el usuario dice "rollos grandes" o "rollo de queso grande", mapea a "Rollos grandes".
4. Si el usuario dice "rollos pequeños" o "rollo de queso pequeño", mapea a "Rollos pequeños".
5. Si dice "empanada integral", mapea a "Empanada Integral".
6. Si dice "empanadas" o "empanadas normales", mapea a "Empanadas a Bs.3.5".
7. Si el producto mencionado no está en la lista de ninguna forma, usa el nombre mencionado con ortografía correcta.

Para cada transacción extraída:
- Determina el tipo: "venta" para ventas o dictados de tipo vendido/vendí, o "produccion" para productos producidos/elaborados/horneados.
- Determina la cantidad (número entero).
- Para ventas ("venta"), determina el precio unitario en Bs. Si el usuario especifica un precio (ej. "a 4 bolivianos" o "a Bs 4" o "cada una a 4Bs"), usa ese precio. Si no menciona ningún precio específico, usa el precio normal del producto del listado.`;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: "Eres un asistente de panadería inteligente experto en procesar texto de voz a registros estructurados.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "Must be either 'venta' (sale) or 'produccion' (production)" },
                  product: { type: Type.STRING, description: "Exact name of the product matched from the list" },
                  quantity: { type: Type.INTEGER, description: "Quantity of the items produced or sold" },
                  price: { type: Type.NUMBER, description: "Unit price for 'venta', optional/not used for 'produccion'" }
                },
                required: ["type", "product", "quantity"]
              }
            }
          },
          required: ["transactions"]
        }
      }
    });

    const dataStr = response.text?.trim() || '{"transactions":[]}';
    const parsed = JSON.parse(dataStr);
    res.json(parsed);
  } catch (err: any) {
    console.error("Error processing sales audio:", err);
    res.status(500).json({ error: "Error de procesamiento de IA: " + err.message });
  }
});

// API Route for parsing expenses voice content
app.post("/api/ai/parse-gastos", async (req, res) => {
  try {
    const { text, categories, payers } = req.body;
    if (!text) {
      return res.status(400).json({ error: "El texto es requerido" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "API Key de Gemini no configurada. Por favor, agregue GEMINI_API_KEY en Panel lateral > Settings > Secrets." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const categoriesStr = categories ? categories.join(', ') : 'Gasto General, Material';
    const payersStr = payers ? payers.join(', ') : 'Sra. Aurelia, Lesly';

    const prompt = `Analiza la transcripción de voz de un panadero y extrae todos los gastos (expenses) de panadería descritos. El usuario puede dictar múltiples gastos a la vez (por ejemplo: "he comprado huevos a 40Bs y harina de trigo a 150Bs"). Extrae cada uno de ellos como un objeto individual en la lista "expenses".
Texto: "${text}"

Categorías disponibles: [${categoriesStr}]
Pagadores de material disponibles: [${payersStr}]

Reglas importantes de procesamiento de gastos:
1. Corrige la descripción del gasto para que tenga una gramática y ortografía perfectas en español. Debe ser corta y clara (ej. "Harina de trigo", "Pasaje de transporte", "Compra de huevos", "Gas").
2. Extrae el monto en Bs. (número).
3. Clasifica el gasto en una de las categorías disponibles:
   - "Material" si es para materias primas de horneado (como harina, huevos, queso, polvo de hornear, levadura, etc.).
   - "Gasto General" para cualquier otro gasto general (servicios, pasajes, pasajes en minibús, luz, detergentes, etc.).
4. Si la categoría es "Material", identifica el pagador si se menciona (uno de [${payersStr}]). Si se nombra a Aurelia o Sra Aurelia, usa "Sra. Aurelia". Si se nombra a Lesly, usa "Lesly". Si no se menciona ningún pagador, o si la categoría no es "Material", colócalo como null.`;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: "Eres un asistente de panadería inteligente experto en procesar gastos con perfecta ortografía y estructura.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expenses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Corrected and high-quality description of the expense in Spanish (first letter capitalized)" },
                  amount: { type: Type.NUMBER, description: "Expense amount in Bolivianos (Bs)" },
                  category: { type: Type.STRING, description: "Category string, must match one of the available categories" },
                  payer: { type: Type.STRING, description: "Name of the person paying (only for Material categories, nullable)" }
                },
                required: ["description", "amount", "category"]
              }
            }
          },
          required: ["expenses"]
        }
      }
    });

    const dataStr = response.text?.trim() || '{"expenses":[]}';
    const parsed = JSON.parse(dataStr);
    res.json(parsed);
  } catch (err: any) {
    console.error("Error processing expenses audio:", err);
    res.status(500).json({ error: "Error de procesamiento de IA: " + err.message });
  }
});

export async function configureViteMiddleware(appInstance: express.Express) {
  if (process.env.VERCEL) {
    // Escapar configuración de Vite en Vercel para que compile y funcione como Serverless de forma óptima.
    return;
  }
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    appInstance.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    appInstance.use(express.static(distPath));
    appInstance.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

export default app;
