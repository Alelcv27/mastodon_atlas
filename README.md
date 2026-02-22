# MastodonAtlas
MastodonAtlas is an interactive visualization tool for exploring Mastodon server networks and their interconnections.

## Features
- **Interactive Graph Visualization**: Explore networks with Sigma.js, including zoom, navigation, and node selection
- **Semantic Search**: Search powered by Sentence Transformers
- **Advanced Similarity Metrics**: Supports multiple affinity measures (Node2Vec, content analysis, etc.)
- **Detailed Information**: Displays full metadata, including server descriptions, rules, and user statistics
- **Import/Export**: Load custom JSON files and export visualizations as PNG

## Architecture
- **Frontend**: React application with Sigma.js for graph rendering
- **Backend**: Flask API with Sentence Transformers for semantic search
- **Data Format**: JSON files containing node, edge, and metadata structures

## System Requirements
### Backend
- **Python 3.8+** (3.9 or 3.10 recommended)
### Frontend  
- **Node.js 16+** (18+ recommended)
- **npm 8+** or **yarn 1.22+**

## Installation Guide
### 1. Project Setup

```bash
# Download and extract the project, then enter the folder
cd mastodon-atlas
```
### 2. Backend Configuration

**Required Backend Packages:**
- `flask==2.3.3`
- `flask-cors==4.0.0`
- `sentence-transformers==2.2.2`
- `numpy==1.24.3`
- `scikit-learn==1.3.0`
- `torch==2.0.1`
- `transformers==4.33.2`
- `huggingface-hub==0.16.4`
### 3. Frontend Configuration

```bash
# Install frontend dependencies
npm install
```

**Required Frontend Packages:**
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

## Running the Application

### Step 1: Start the Backend Server
**⚠️ Important:** The backend server must be running before semantic search can be used.

```bash
# Go to the backend folder
cd backend

# Activate the virtual environment (if created)
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Start Flask
python app.py
```

**Expected result:**
```
* Running on http://127.0.0.1:5000
* Debug mode: on
```

The API server will be available at `http://localhost:5000`

### Step 2: Start the Web Interface
Open a **new terminal** (keep the backend running) and execute:

```bash
# Make sure you are in the root folder
cd mastodon-atlas

# Start React
npm start
```

**Expected result:**
```
Compiled successfully!
  
You can now view MastodonAtlas in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

The application will open automatically in your browser at `http://localhost:3000`

### Step 3: Verify Functionality
1. **Backend**: Visit `http://localhost:5000` - you will see a basic Flask page or a 404 error (normal)
2. **Frontend**: The MastodonAtlas interface should load at `http://localhost:3000`
3. **Search**: Try semantic search to verify backend-frontend communication

### What to Expect
After installation, you will have:
- A web interface at `http://localhost:3000` with interactive graph visualization
- Preloaded sample Mastodon network data (no additional files required)
- Working semantic search
- Controls for zoom, filtering, and exploration

The project includes sample data and pre-trained models, so everything works immediately.

## Getting Started

### First Steps
1. **Open the Application**: Go to `http://localhost:3000`
2. **Explore the Data**: The app automatically loads the Mastodon server network
3. **Basic Navigation**:
   - Click nodes to view server details
   - Use the mouse wheel to zoom
   - Drag to move the view
4. **Try Search**: Enter terms such as "gaming" or "art" in semantic search 🔎

### Advanced Features
1. **Import Custom Data**: Use "📁 Import" to load custom JSON files
2. **Export Images**: Click "📸 Export" to save the visualization

### Main Controls
**Node Selection**: By clicking a node, you can:
- View detailed information (description, rules, active users)
- Display similar nodes according to available metrics
- Highlight network connections

**Semantic Search**: With search 🔎, you can:
- Find nodes related to a specific topic
- Choose whether to search in titles, descriptions, or both

**Control Panel**:
- **Min Connections**: Filter by number of connections
- **Similarity**: Select the similarity metric
- **Top K**: Set how many results to display
- **Node Sizes**: Real or uniform node sizes

### Navigation
- **Zoom**: +/- buttons or mouse wheel
- **Move**: Drag to navigate
- **Reset View**: 🎯 button to center and reset zoom
- **History**: Undo/Redo buttons to return to previous views

## Data Format
MastodonAtlas uses JSON files with the following structure:

```json
{
  "nodes": [
    {
      "id": "server.example.com",
      "x": 0.5,
      "y": 0.3,
      "size": 10,
      "color": "#3498db",
      "metadata": {
        "title": "Example Server",
        "description": "A welcoming Mastodon community",
        "url": "https://server.example.com",
        "active_users": 1500,
        "rules": ["Be kind", "No spam", "Respect the law"]
      },
      "attributes": {
        "custom_field": "value"
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

### Required Node Fields:
- `id` - Unique identifier (usually server domain)
- `x`, `y` - Position coordinates
- `size` - Size
- `color` - Color (hex format)
- `metadata` - Additional information
- `attributes` - Custom properties

### Edge Fields:
- `source`, `target` - IDs of connected nodes
- `size` - Edge thickness
- `color` - Edge color
- `attributes` - Attributes
- `similarities` - Similarity scores

## Project Structure

```
mastodon-atlas/
├── backend/          # Flask API server
│   ├── app.py        # Main application
│   ├── *.pkl         # Pre-trained models
├── src/              # React source code
│   ├── components/   # React components
│   │   └── sigmaGraph.jsx  # Main graph component
│   ├── api.js        # API client
│   └── App.jsx       # Root component
├── public/           # Static files
└── package.json      # Frontend dependencies
```