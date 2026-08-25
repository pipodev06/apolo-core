const SAMBANOVA_URL = "https://api.sambanova.ai/v1/chat/completions";
const MODEL = "Meta-Llama-3.3-70B-Instruct";

const URGENCIAS = ["CRITICO", "ALTO", "MEDIO", "BAJO"] as const;
type Urgencia = (typeof URGENCIAS)[number];

interface AnalizarTicketParams {
  apiKey: string;
  titulo: string;
  descripcion: string;
  areas: string[];
}

export interface AnalisisTicket {
  area: string | null;
  urgencia: Urgencia | null;
}


export async function analizarTicket(params: AnalizarTicketParams): Promise<AnalisisTicket> {
  const { apiKey, titulo, descripcion, areas } = params;

  const prompt = `Eres un clasificador de tickets de soporte técnico. Analiza el siguiente ticket y determina:

1. El ÁREA responsable de resolver la CAUSA RAÍZ del problema (elige EXACTAMENTE una de la lista, copiando el texto tal cual) — no necesariamente el área donde se nota el síntoma, sino la que puede solucionarlo.
2. El grado de URGENCIA del incidente:
   - CRITICO: servicio caído / afecta a todos, O cualquier incidente de seguridad (ransomware, acceso no autorizado, fuga o robo de datos) sin importar a cuántos usuarios afecta hoy — el riesgo potencial define la urgencia, no solo el alcance actual.
   - ALTO: afecta a varios usuarios o a una función clave del negocio.
   - MEDIO: afecta a un usuario o a una función secundaria.
   - BAJO: consulta, mejora o algo sin impacto operativo.
   Si la descripción no da información suficiente para decidir con certeza, usa MEDIO por defecto — no asumas el peor ni el mejor caso sin evidencia en el texto.

Áreas disponibles:
${areas.map((a) => `- ${a}`).join("\n")}

Ticket:
Título: ${titulo}
Descripción: ${descripcion}

Responde ÚNICAMENTE con un JSON de la forma {"area": "<una de las áreas de la lista>", "urgencia": "CRITICO|ALTO|MEDIO|BAJO"}. Sin texto adicional.`;

  const res = await fetch(SAMBANOVA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 150,
      // Fuerza JSON válido a nivel de API (SambaNova es compatible con el
      // response_format de OpenAI) — capa extra sobre la instrucción del
      // prompt, no reemplaza el parseo con regex de más abajo, que sigue
      // como red de seguridad si el modelo igual devuelve texto extra.
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SambaNova respondió ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return { area: null, urgencia: null };

  try {
    const parsed = JSON.parse(match[0]) as { area?: string; urgencia?: string };

    const area = areas.find((a) => a.toLowerCase() === parsed.area?.trim().toLowerCase()) ?? null;
    const urgencia =
      URGENCIAS.find((u) => u === parsed.urgencia?.trim().toUpperCase()) ?? null;

    return { area, urgencia };
  } catch {
    return { area: null, urgencia: null };
  }
}
