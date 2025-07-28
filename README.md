# MastodonAtlas
MastodonAtlas è uno strumento di visualizzazione interattiva per l'esplorazione delle reti di server Mastodon e delle loro interconnessioni. Integra visualizzazione grafica avanzata con funzionalità di ricerca semantica per analizzare collegamenti, affinità e comunità all'interno delle reti sociali decentralizzate.

## Funzionalità
- **Visualizzazione Grafica Interattiva**: Esplora le reti attraverso Sigma.js con zoom, navigazione e selezione dei nodi
- **Ricerca Semantica Intelligente**: Ricerca basata su intelligenza artificiale tramite Sentence Transformers
- **Metriche di Similarità Avanzate**: Supporta diverse misure di affinità (Node2Vec, analisi contenuto, ecc.)
- **Informazioni Dettagliate**: Visualizza metadati completi con descrizioni server, regolamenti e statistiche utenti
- **Importa/Esporta**: Carica file JSON personalizzati ed esporta le visualizzazioni in formato PNG
- **Interfaccia Moderna**: Design responsive con controlli per etichette e dimensioni

## Architettura
- **Frontend**: Applicazione React con Sigma.js per il rendering grafico
- **Backend**: API Flask con Sentence Transformers per la ricerca semantica
- **Formato Dati**: File JSON con struttura nodi, archi e metadati

## Requisiti di Sistema
### Backend
- **Python 3.8+** (consigliato 3.9 o 3.10)
### Frontend  
- **Node.js 16+** (consigliato 18+)
- **npm 8+** oppure **yarn 1.22+**

## Guida all'Installazione
### 1. Preparazione del Progetto

```bash
# Scarica e decomprimi il progetto, quindi entra nella cartella
cd vis-graph
```
### 2. Configurazione Backend

**Pacchetti Backend Necessari:**
- `flask==2.3.3`
- `flask-cors==4.0.0`
- `sentence-transformers==2.2.2`
- `numpy==1.24.3`
- `scikit-learn==1.3.0`
- `torch==2.0.1`
- `transformers==4.33.2`
- `huggingface-hub==0.16.4`
### 3. Configurazione Frontend

```bash
# Installa le dipendenze frontend
npm install
```

**Pacchetti Frontend Necessari:**
- `react@18.2.0`
- `react-dom@18.2.0`
- `react-scripts@5.0.1`
- `sigma@3.0.2`
- `graphology@0.26.0`
- `react-vis-network-graph@3.0.1`
- `web-vitals@2.1.4`
- `@testing-library/jest-dom@5.16.5`
- `@testing-library/react@13.4.0`
- `@testing-library/user-event@13.5.0`

## Avvio dell'Applicazione

### Fase 1: Avvia il Server Backend
**⚠️ Importante:** Il server backend deve essere attivo prima di poter utilizzare la ricerca semantica.

```bash
# Vai nella cartella backend
cd backend

# Attiva l'ambiente virtuale (se creato)
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Avvia Flask
python app.py
```

**Risultato atteso:**
```
* Running on http://127.0.0.1:5000
* Debug mode: on
```

Il server API sarà disponibile su `http://localhost:5000`

### Fase 2: Avvia l'Interfaccia Web
Apri un **nuovo terminale** (mantieni attivo il backend) ed esegui:

```bash
# Assicurati di essere nella cartella principale
cd vis-graph

# Avvia React
npm start
```

**Risultato atteso:**
```
Compiled successfully!
  
You can now view MastodonAtlas in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

L'applicazione si aprirà automaticamente nel browser all'indirizzo `http://localhost:3000`

### Fase 3: Verifica del Funzionamento
1. **Backend**: Visita `http://localhost:5000` - vedrai una pagina Flask base o errore 404 (normale)
2. **Frontend**: L'interfaccia MastodonAtlas deve caricarsi su `http://localhost:3000`
3. **Ricerca**: Prova la ricerca semantica per verificare la comunicazione backend-frontend

### Cosa Aspettarsi
Dopo l'installazione avrai:
- Interfaccia web su `http://localhost:3000` con visualizzazione grafica interattiva
- Dati di esempio pre-caricati della rete Mastodon (nessun file aggiuntivo necessario)
- Ricerca semantica IA funzionante
- Controlli per zoom, filtri ed esplorazione

Il progetto include dati campione e modelli IA pre-addestrati - tutto funziona immediatamente.

## Come Iniziare

### Primi Passi
1. **Apri l'Applicazione**: Vai su `http://localhost:3000`
2. **Esplora i Dati**: L'app carica automaticamente la rete di server Mastodon
3. **Navigazione Base**:
   - Clicca sui nodi per vedere dettagli server
   - Rotella mouse per zoom
   - Trascinamento per spostare la vista
4. **Prova la Ricerca**: Inserisci termini come "gaming" o "arte" nella ricerca semantica 🔎

### Funzioni Avanzate
1. **Importa Dati Personali**: Usa "📁 Import" per caricare file JSON personalizzati
2. **Esporta Immagini**: Clicca "📸 Export" per salvare la visualizzazione

### Controlli Principali
**Selezione Nodi**: Cliccando su un nodo puoi:
- Vedere informazioni dettagliate (descrizione, regole, utenti attivi)
- Visualizzare nodi simili secondo le metriche disponibili
- Evidenziare le connessioni nella rete

**Ricerca Semantica**: Con la ricerca 🔎 puoi:
- Trovare nodi correlati a un argomento specifico
- Scegliere se cercare in titoli, descrizioni o entrambi

**Pannello Controlli**:
- **Min Connections**: Filtra per numero di collegamenti
- **Similarity**: Seleziona la metrica di similarità
- **Top K**: Imposta quanti risultati mostrare
- **Node Sizes**: Dimensioni reali o uniformi

### Navigazione
- **Zoom**: Pulsanti +/- o rotella mouse
- **Movimento**: Trascina per navigare
- **Reset Vista**: Pulsante 🎯 per centrare e ripristinare zoom
- **Cronologia**: Pulsanti Annulla/Ripeti per tornare alle visualizzazioni precedenti

## Formato Dati
MastodonAtlas utilizza file JSON con questa struttura:

```json
{
  "nodes": [
    {
      "id": "server.esempio.com",
      "x": 0.5,
      "y": 0.3,
      "size": 10,
      "color": "#3498db",
      "metadata": {
        "title": "Server Esempio",
        "description": "Una comunità Mastodon accogliente",
        "url": "https://server.esempio.com",
        "active_users": 1500,
        "rules": ["Sii gentile", "No spam", "Rispetta le leggi"]
      },
      "attributes": {
        "campo_personalizzato": "valore"
      }
    }
  ],
  "edges": [
    {
      "source": "server1.com",
      "target": "server2.com",
      "size": 0.5,
      "attributes": {},
      "color": "#cccccc",
      "similarities": {
        "node2vec_similarity": 0.85,
        "content_similarity": 0.72
      }
    }
  ]
}
```

### Campi Obbligatori Nodi:
- `id` - Identificatore univoco (solitamente dominio server)
- `x`, `y` - Coordinate posizione
### Campi Opzionali Nodi:
- `size` - Dimensione visuale
- `color` - Colore (formato esadecimale)
- `metadata` - Informazioni aggiuntive
- `attributes` - Proprietà personalizzate

### Campi Archi:
- `source`, `target` - ID nodi collegati (obbligatori)
- `size` - Spessore collegamento (opzionale)
- `color` - Colore collegamento (opzionale)
- `attributes` - Metriche similarità (opzionale)

## Struttura Progetto

```
vis-graph/
├── backend/          # Server API Flask
│   ├── app.py        # Applicazione principale
│   ├── *.pkl         # Modelli pre-addestrati
├── src/              # Codice sorgente React
│   ├── components/   # Componenti React
│   │   └── sigmaGraph.jsx  # Componente grafico principale
│   ├── api.js        # Client API
│   └── App.jsx       # Componente radice
├── public/           # File statici
└── package.json      # Dipendenze frontend
```
## Note Tecniche
- Il backend utilizza embeddings pre-calcolati in file `.pkl` per ricerche veloci (inclusi nel progetto)
- I dati campione si caricano automaticamente, ma è possibile importare grafi personalizzati
- La ricerca semantica richiede il server Flask attivo
- Supporta file grafi di grandi dimensioni con filtri e ottimizzazioni integrate