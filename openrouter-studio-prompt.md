# OpenRouter Studio — Documento di progetto per Claude Code

## Obiettivo

Costruire **OpenRouter Studio**: una web app Next.js self-hostabile che funziona da frontend visuale (canvas node-based) per le API di OpenRouter. L'utente inserisce la propria API key di OpenRouter e può costruire pipeline di generazione AI collegando nodi su un canvas drag-and-drop, senza dipendere da servizi esterni o crediti di terze parti.

---

## Stack tecnologico

- **Framework**: Next.js 14+ (App Router)
- **Canvas node-based**: React Flow (`@xyflow/react`) — libreria matura, open source, ottima per questo use case
- **Styling**: Tailwind CSS + shadcn/ui per i componenti UI
- **State management**: Zustand (per lo stato del canvas e dei nodi)
- **Storage**: localStorage per API key e salvataggio workflow (nessun DB richiesto per il MVP)
- **HTTP client**: fetch nativo (Next.js server actions o API routes per proxare le chiamate OpenRouter)
- **Language**: TypeScript

---

## Architettura generale

```
app/
├── page.tsx                  → Homepage / redirect al canvas
├── studio/
│   └── page.tsx              → Pagina principale con il canvas
├── api/
│   ├── openrouter/
│   │   ├── models/route.ts   → GET lista modelli da OpenRouter
│   │   ├── chat/route.ts     → POST chat/LLM completions
│   │   ├── image/route.ts    → POST image generation
│   │   └── video/route.ts    → POST video generation
│   └── proxy/route.ts        → Proxy generico per altri endpoint OpenRouter
│   └── utils/
│       └── fetch-image/route.ts → Fetch URL remoto → base64 (evita CORS)
components/
├── canvas/
│   ├── StudioCanvas.tsx      → Wrapper React Flow principale
│   ├── NodePanel.tsx         → Pannello laterale per aggiungere nodi
│   └── nodes/
│       ├── PromptNode.tsx    → Nodo input testo/prompt
│       ├── ImageInputNode.tsx → Nodo input immagine (upload/URL + base64)
│       ├── LLMNode.tsx       → Nodo chat/completions LLM (con vision)
│       ├── ImageNode.tsx     → Nodo image generation (multi-reference)
│       ├── VideoNode.tsx     → Nodo video generation (first frame, char ref, style ref)
│       ├── OutputNode.tsx    → Nodo visualizzazione output
│       └── index.ts          → Export nodeTypes per React Flow
├── ui/
│   ├── ApiKeyModal.tsx       → Modal per inserire/modificare API key
│   ├── ModelSelector.tsx     → Dropdown per selezionare modello OpenRouter
│   └── ResultViewer.tsx      → Visualizzatore immagini/video/testo
lib/
├── openrouter.ts             → Client OpenRouter (fetch wrapper)
├── models.ts                 → Tipi e costanti per i modelli
└── store.ts                  → Zustand store (canvas state, API key, workflow)
```

---

## Funzionalità richieste (MVP)

### 1. Gestione API Key

- Al primo avvio, mostrare un modal che chiede la OpenRouter API key
- Salvarla in localStorage (chiave: `openrouter_api_key`)
- Mostrare un'icona/badge nell'header con status connessione (verde/rosso)
- Permettere di cambiarla o rimuoverla dalle impostazioni
- **Non esporre mai la chiave lato client direttamente nelle chiamate HTTP** — tutte le chiamate OpenRouter devono passare per le Next.js API routes, che leggono la chiave dall'header `x-api-key` passato dal frontend

### 2. Canvas Node-Based (React Flow)

Il canvas deve supportare:

- **Drag & drop** di nodi dal pannello laterale al canvas
- **Connessioni** tra nodi tramite handle di input/output
- **Zoom e pan** del canvas
- **Salvataggio** del workflow in localStorage
- **Caricamento** di workflow salvati
- **Nuovo workflow** (reset canvas)

#### Tipi di nodi da implementare:

**PromptNode** (input testo)
- Textarea per inserire il prompt
- Handle di output: `prompt` (string)
- Opzione per inserire un system prompt separato

**ImageInputNode** (input immagine — nodo fondamentale)
- Permette di caricare un'immagine da file locale (drag & drop o click per scegliere file) OPPURE incollare un URL immagine
- Preview dell'immagine caricata inline nel nodo (thumbnail 180x180, object-fit: cover)
- L'immagine viene convertita in base64 se caricata da file locale, oppure mantenuta come URL se è un URL remoto
- Handle di output multipli:
  - `image_url` (string) — URL o data URL base64 dell'immagine
  - `image_base64` (string) — sempre la versione base64 (utile per modelli che non accettano URL)
- Label configurabile nel nodo (es. "Personaggio", "Primo frame", "Stile riferimento") per identificare il ruolo dell'immagine nel workflow
- Supporta PNG, JPG, WEBP, GIF (max 10MB)
- Se si usa un URL remoto, mostrare un pulsante "Fetch & Preview" per caricare l'anteprima

**LLMNode** (chat/completions)
- Handle di input: `prompt` (string), `system` (string, opzionale), `context` (string, opzionale), `image_url` (string, opzionale — per modelli vision multimodali)
- Handle di output: `text` (string)
- Dropdown per selezionare il modello (fetcha da `/api/openrouter/models`, filtrato per modelli text)
- Parametri configurabili nel nodo: temperature, max_tokens
- Pulsante "Run" per eseguire
- Mostra output inline nel nodo (scrollabile, max 200px)
- Se è connessa una `image_url`, la include nel messaggio come content block multimodale (OpenAI-compatible vision format)

**ImageNode** (image generation)
- Handle di input:
  - `prompt` (string) — obbligatorio
  - `image_ref_N` (string, image_url) — **multiplo e dinamico**, tutti opzionali. Parte con un handle `image_ref_1` visibile. Ogni volta che viene connesso un handle, appare automaticamente il successivo (`image_ref_2`, `image_ref_3`, ...) senza limite fisso. Se un handle viene disconnesso, collassa nuovamente (ma non rimuove handle intermedi già connessi).
- Handle di output: `image_url` (string)
- Gli handle `image_ref_*` connessi mostrano thumbnail preview (40x40)
- Dropdown per selezionare modello immagine (filtrato per `modalities` che include `image`)
- Parametri: aspect ratio (dropdown completo OR: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 1:4, 4:1, 1:8, 8:1), image size (0.5K/1K/2K/4K)
- Parametri Sourceful (solo per modelli `sourceful/*`): `font_inputs` (max 2 coppie font_url+text) e `super_resolution_references` (max 4 URL, una per riga)
- Modalità selezionabile: "Text to Image" / "Image to Image" (edit/variation a partire da una reference)
- Pulsante "Generate"
- Preview immagine output inline nel nodo (thumbnail 200x200)

**VideoNode** (video generation)
- Handle di input — tutti opzionali tranne `prompt`:
  - `prompt` (string) — obbligatorio
  - `first_frame` (string, image_url) — opzionale, singolo
  - `last_frame` (string, image_url) — opzionale, singolo
  - `character_ref_N` (string, image_url) — **multiplo e dinamico**: parte con `character_ref_1`, ogni connessione genera il successivo automaticamente. Serve a passare più personaggi distinti nella stessa generazione (es. personaggio A + personaggio B). Stesso pattern degli handle dinamici di ImageNode.
  - `style_ref` (string, image_url) — opzionale, singolo
- Handle di output: `video_url` (string)
- Gli handle immagine connessi mostrano thumbnail preview (40x40)
- Dropdown per selezionare modello video (filtrato per `modalities` che include `video`)
- Parametri: durata in secondi (4/8/16 se supportato), aspect ratio (16:9, 9:16, 1:1)
- Pulsante "Generate"
- Status inline: idle / loading / done / error
- Player video inline (tag `<video controls>`) quando l'output è disponibile
- Warning inline non bloccante se il modello selezionato non supporta uno degli input immagine connessi

**Implementazione handle dinamici (pattern da seguire per `image_ref_N` e `character_ref_N`):**
```typescript
// Nel nodo, tenere traccia di quanti handle dinamici mostrare
// Regola: mostrare sempre (numero di handle connessi + 1) handle, minimo 1
// Esempio: 0 connessi → mostra image_ref_1
//          1 connesso  → mostra image_ref_1, image_ref_2
//          2 connessi  → mostra image_ref_1, image_ref_2, image_ref_3

// Zustand store: per ogni nodo, salvare quanti handle dinamici sono attivi
dynamicHandleCounts: Record<nodeId, { image_ref: number, character_ref: number }>

// React Flow: gli handle devono avere id stabili (image_ref_1, image_ref_2, ...)
// Gli edge connessi determinano quali sono "occupati"
// Il conteggio si aggiorna onConnect e onDisconnect
```

**OutputNode** (visualizzatore)
- Handle di input: `text` (string), `image_url` (string), `video_url` (string) — accetta qualsiasi tipo
- Visualizza automaticamente il tipo corretto: testo formattato, immagine fullsize, video player
- Pulsante download per immagini e video

**Modelli video disponibili (alpha OpenRouter):**
- `google/veo-3.1` — duration: 4/6/8s, resolution: 720p/1080p/4K, aspect: 16:9/9:16, audio: sì, input_references: fino a 4 (1 i2v + 3 ref)
- `openai/sora-2-pro` — duration: 4/8/12/16/20s, resolution: 720p/1080p, aspect: 16:9/9:16, audio: sì, input_references: max 1
- `bytedance/seedance-1-5-pro` — duration: 4-12s, resolution: 480p/720p/1080p, aspect: 16:9/9:16/4:3/3:4/1:1/21:9, audio: sì, input_references: 1-2 (first/last frame)

Il VideoNode deve mostrare un badge **"⚡ Alpha"** nell'header per comunicare che l'API è sperimentale e lo spec può cambiare.

### 3. Esecuzione pipeline

- Ogni nodo ha un pulsante "Run" che esegue solo quel nodo
- I nodi ricevono automaticamente l'input dai nodi connessi tramite React Flow
- Lo stato di esecuzione è visibile sul nodo: bordo grigio (idle), bordo giallo animato (loading), bordo verde (done), bordo rosso (error)
- Errori mostrati inline nel nodo con messaggio leggibile

### 4. Lista modelli da OpenRouter

La route `/api/openrouter/models` deve:

```typescript
// GET /api/openrouter/models
// Chiama GET https://openrouter.ai/api/v1/models
// Ritorna lista filtrata per categoria:
// - text: architecture.modality include "text->text"
// - image: architecture.modality include "text->image"  
// - video: architecture.modality include "text->video" o "image->video"
```

Il frontend cachea la lista in memoria (React state / Zustand) per la sessione.

### 5. API Routes (proxy OpenRouter)

#### `/api/openrouter/chat` — POST
```typescript
// Body: { model, messages, temperature?, max_tokens? }
// Legge API key dall'header x-api-key
// Chiama POST https://openrouter.ai/api/v1/chat/completions
// Ritorna la risposta di OpenRouter as-is
```

#### `/api/openrouter/image` — POST
```typescript
// Body: { model, prompt, n?, size? }
// OpenRouter image generation usa lo stesso endpoint /v1/images/generations
// (compatibile OpenAI)
// Ritorna: { data: [{ url: string }] }
```

#### `/api/openrouter/video` — endpoint multipli (v1 async)

**La generazione video usa `POST /api/v1/videos`, NON `/v1/chat/completions`.**
Il flusso è asincrono in 3 step: submit → polling → download.

```typescript
// POST /api/openrouter/video — sottomette il job
// Body:
{
  model: string,           // modelli video disponibili da /api/v1/models?output_modalities=video
  prompt: string,
  duration?: number,       // veo-3.1: 4/6/8s | sora-2-pro: 4/8/12/16/20s | seedance: 4-12s
  resolution?: string,     // "480p" | "720p" | "1080p" | "4K" — NON combinare con size
  aspect_ratio?: string,   // "16:9" | "9:16" | "1:1" ecc — NON combinare con size
  size?: string,           // "1920x1080" — alternativa a resolution+aspect_ratio
  generate_audio?: boolean,
  seed?: number,
  input_references?: Array<{ type: "image_url", image_url: { url: string } }>
  // url può essere HTTPS o data URI base64
  // Limiti per modello: veo-3.1 (1 i2v + fino a 3 ref), sora-2-pro (1 max), seedance (1-2 first/last frame)
}
// → Chiama POST https://openrouter.ai/api/v1/videos
// → Risposta HTTP 202: { id: "vgen_...", polling_url: "...", status: "pending" }

// GET /api/openrouter/video?jobId=vgen_... — polling status
// → Chiama GET https://openrouter.ai/api/v1/videos/:jobId
// → Statuses: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "expired"
// → Quando completed: { ..., unsigned_urls: ["https://openrouter.ai/api/v1/videos/:id/content?index=0"] }
// → Quando failed: { ..., error: "stringa errore" }

// GET /api/openrouter/video/download?jobId=vgen_...&index=0 — scarica il video
// → Chiama GET https://openrouter.ai/api/v1/videos/:jobId/content?index=0
// → Proxy dei byte MP4 raw al client
// ⚠️ Gli URL video scadono entro 1-48h — il VideoNode deve avvisare l'utente di scaricare
```

**Il polling viene gestito lato client nel VideoNode:**
```typescript
// Dopo il submit, il VideoNode avvia un setInterval ogni 30 secondi
// che chiama GET /api/openrouter/video?jobId=...
// Quando status === "completed", ferma il polling e mostra il player video
// Mostrare un timer/countdown visivo nel nodo durante l'attesa
```

---

## UI e Design

- **Tema**: dark mode di default, con possibilità di toggle light/dark
- **Palette**: sfondo `#0f0f0f`, canvas `#141414`, nodi `#1e1e1e` con bordo `#333`, accent color `#ff6b35` (arancione OpenRouter-style)
- **Font**: Geist (già incluso in Next.js 14+)
- **Header**: logo "OpenRouter Studio" a sinistra, status API key al centro, pulsanti salva/carica/nuovo workflow a destra
- **Pannello sinistro**: lista tipi di nodi trascinabili, con icone e descrizione breve
- **Canvas**: occupa tutto lo spazio restante, minimap in basso a destra
- I nodi devono avere un aspetto pulito e professionale: header colorato per tipo (viola per LLM, arancione per immagini generative, verde per ImageInput, blu per video, grigio per prompt/output), body con i controlli
- Gli handle delle immagini di riferimento su ImageNode e VideoNode devono mostrare una piccola thumbnail preview (40x40px) quando connessi a un ImageInputNode, così l'utente vede subito quale immagine sta usando

---

## Comportamento chiave da implementare correttamente

### Passaggio dati tra nodi connessi

Quando l'utente clicca "Run" su un nodo:
1. React Flow fornisce la lista degli edge connessi
2. Il nodo legge i valori dagli handle di input guardando i nodi sorgente connessi
3. I valori sono letti dallo Zustand store (ogni nodo salva il suo ultimo output nello store)

```typescript
// Struttura store per gli output dei nodi
nodeOutputs: Record<string, {
  text?: string
  image_url?: string        // URL remoto o data URL base64
  image_base64?: string     // sempre base64 pura (senza prefisso data:)
  video_url?: string
  status: 'idle' | 'loading' | 'done' | 'error'
  error?: string
}>
```

### Gestione immagini in input (ImageInputNode)

Il nodo `ImageInputNode` deve gestire due casi:

**Caso 1 — Upload da file locale:**
```typescript
// Convertire il file in base64 con FileReader
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string) // "data:image/png;base64,..."
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
// Salvare sia il data URL completo (image_url) che la base64 pura (image_base64)
const dataUrl = await toBase64(file)
const base64 = dataUrl.split(',')[1]
```

**Caso 2 — URL remoto:**
```typescript
// Salvare l'URL direttamente come image_url
// Offrire un pulsante "Fetch & convert to base64" per convertirlo lato server
// API route: POST /api/utils/fetch-image { url } → { base64, mimeType }
// Questo serve perché alcuni modelli accettano solo base64, non URL arbitrari
```

**Come i nodi downstream usano le immagini:**

Quando `ImageNode` o `VideoNode` ricevono immagini di riferimento dagli handle, le includono nella chiamata API nel formato corretto per il modello selezionato. Per i modelli OpenRouter che supportano immagini nel prompt (vision/multimodal), usare il formato OpenAI-compatible:

```typescript
// Formato per includere immagine nel messages array
{
  role: "user",
  content: [
    { type: "text", text: prompt },
    {
      type: "image_url",
      image_url: {
        url: imageUrl // può essere "https://..." oppure "data:image/png;base64,..."
      }
    }
  ]
}
```

Per i modelli image generation che accettano `image` come parametro separato (es. image-to-image), passarlo nel body della richiesta come `image` o `init_image` a seconda delle specifiche del modello.

### Gestione generazione video (alpha async)

Il VideoNode ha un ciclo di vita diverso dagli altri nodi perché la generazione è asincrona e può richiedere minuti:

```
[Generate] → status: "submitting" → status: "pending/in_progress" (polling ogni 30s) → status: "completed" | "failed"
```

**Stati visivi del VideoNode:**
- `idle` — bordo grigio, pulsante Generate attivo
- `submitting` — spinner, "Submitting..."
- `pending` / `in_progress` — bordo giallo pulsante, timer elapsed ("⏳ 0:32 / ~2-5 min"), pulsante Generate disabilitato
- `completed` — bordo verde, player `<video controls>` inline con `unsigned_urls[0]`, pulsante download
- `failed` — bordo rosso, messaggio errore dall'API (es. "Content moderation: prompt was flagged")
- `expired` / `cancelled` — bordo grigio, messaggio informativo

**Avviso scadenza URL:** quando lo status diventa `completed`, mostrare un badge arancione nel nodo: "⚠️ Video URL expires in ~24h — download now". Gli URL `unsigned_urls` scadono entro 1-48h a seconda del provider.

**Salvataggio job ID nello store:** il job ID (`vgen_...`) va salvato nello Zustand store così se l'utente ricarica la pagina può continuare a fare polling sul job in corso.

### Salvataggio workflow

```typescript
// Struttura workflow salvato
interface Workflow {
  id: string
  name: string
  savedAt: string
  nodes: Node[]   // React Flow nodes
  edges: Edge[]   // React Flow edges
}
// Salvare in localStorage come array di Workflow
// Massimo 10 workflow salvati (rimuovere il più vecchio se si supera)
```

---

## Cosa NON fare (per il MVP)

- ❌ Nessun database o backend persistente
- ❌ Nessuna autenticazione utente
- ❌ Nessun sistema di crediti proprio
- ❌ Nessun editor di prompt avanzato (tenere semplice)
- ❌ Non implementare streaming per ora (risposta sincrona va bene)
- ❌ Non aggiungere altri tipi di nodi oltre a quelli specificati

---

## Deployment

L'app deve poter girare con:

```bash
npm install
npm run dev        # sviluppo locale su localhost:3000
npm run build
npm start          # produzione self-hosted
```

Deve funzionare su qualsiasi VPS con Node.js 18+ senza configurazioni speciali. Aggiungere un `README.md` con istruzioni di deploy base (incluso esempio `docker-compose.yml` con immagine Node ufficiale).

---

## Ordine di implementazione consigliato a Claude Code

1. Setup Next.js + Tailwind + shadcn/ui + React Flow + Zustand
2. Layout base (header + pannello sinistro + canvas)
3. API route `/api/openrouter/models` + test con curl
4. API route `/api/openrouter/chat` + test
5. API route `/api/openrouter/image`
6. API route `/api/openrouter/video`
7. ApiKeyModal + store API key
8. PromptNode + ImageInputNode (upload + URL + base64 conversion)
9. LLMNode funzionante end-to-end (testo + vision con immagine connessa)
10. ImageNode con multi-reference input funzionante
11. VideoNode con first_frame, character_ref, style_ref
12. OutputNode
13. API route `/api/utils/fetch-image` per conversione URL→base64
12. Salvataggio/caricamento workflow
13. Rifinitura UI e dark/light mode
14. README + docker-compose.yml
