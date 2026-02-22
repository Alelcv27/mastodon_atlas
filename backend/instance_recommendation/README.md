# Mastodon Instance Recommendation System

This project presents a recommendation system for Mastodon instances grounded in graph analysis and multiple embedding methodologies. The system models inter-instance relationships and generates similarity-based recommendations by integrating complementary approaches, including network-structural analysis, textual representation learning, and hybrid embedding strategies.

## Project Overview

The project analyzes Mastodon data through a pipeline composed of five principal stages:
- Extraction and preprocessing of instance metadata via the Mastodon API
- Generation of network embeddings using the Node2Vec algorithm
- Generation of textual embeddings from instance descriptions
- Integration of heterogeneous embedding techniques to improve recommendation quality
- Construction of a graph representation that combines metadata and similarity scores

## Data Files
### Input Data

- `data/Mastodon_instances_edges_Sept2024.csv` - Edges between instances

### Generated Files

- `data/Mastodon_instances_edges_Sept2024_filtered.csv` - Filtered edges (weight >= 10, no self-loops)
- `data/Mastodon_instances_metadata_v3.csv` - Comprehensive instance metadata with the following fields:
	- `instance`: Instance domain name
	- `title`: Instance title
	- `description`: Short description
	- `extended_description`: Detailed description
	- `version`: Mastodon version
	- `server_source`: Source code URL
	- `active_users`: Monthly active users
	- `rules`: Instance rules (JSON array)
- `graph.json` - Base graph structure (imported from Gephi)
- `graph_with_metadata.json` - Graph enriched with instance metadata
- `graph_similarities_with_metadata.json` - Graph augmented with similarity scores
- `graph_similarities_with_metadata_cleaned.json` - Final cleaned graph
- `similarities.json` - Pairwise similarity scores between instances

## Notebooks

##### 1. `mastodon_metadata_extractor.ipynb`
**Objective**: Extract metadata from Mastodon instances through API calls.

**Methodological steps**:
- Filter raw edge data (remove self-loops and apply a weight threshold)
- Extract instance attributes: title, description, extended description, rules, and active users
- Clean textual description fields

**Output**: `Mastodon_instances_edges_Sept2024_filtered.csv` and `Mastodon_instances_metadata_v3.csv`

##### 2. `node2vec.ipynb`
**Objective**: Create network embeddings using Node2Vec.

**Methodological steps**:
- Load filtered edge data and construct a NetworkX graph
- Apply Node2Vec to generate node embeddings that encode network structure
- Persist embeddings for downstream similarity computation

**Output**: `embeddings/node2vec_emb.pkl`

##### 3. `sentence_transformers_descr.ipynb`
**Objective**: Generate semantic embeddings from instance descriptions using Sentence Transformers.

**Methodological steps**:
- Load instance metadata and combine the `description` and `extended_description` fields
- Use the `all-MiniLM-L6-v2` model to encode textual descriptions into vector representations
- Produce semantic embeddings that capture meaning, thematic proximity, and content similarity

**Output**: `embeddings/sentence_transformers_emb.pkl`

##### 4. `sentence_transformers_title.ipynb`
**Objective**: Create embeddings based on instance domain names.

**Methodological steps**:
- Encode instance domain names using Sentence Transformers

**Output**: `embeddings/title_emb.pkl`

##### 5. `mixed_embeddings.ipynb`
**Objective**: Combine Node2Vec and description embeddings for hybrid recommendations.

**Methodological steps**:
- Load both Node2Vec embeddings and description-based Sentence Transformer embeddings
- Construct mixed embeddings through element-wise averaging of the two representations
  
**Output**: `embeddings/mixed_emb.pkl`

##### 6. `json_similarities.ipynb`
**Objective**: Compute pairwise similarity between instances using all embedding types.

**Methodological steps**:
- Load all three embedding types (Node2Vec, description, and mixed)
- Compute cosine similarity for each edge in the filtered dataset
- Generate complete similarity scores for instance pairs

**Similarity Types**:
- `node2vec_similarity`: Based on network structure
- `description_similarity`: Based on textual content
- `mixed_similarity`: Combined structural and content similarity

**Output**: `similarities.json`

##### 7. `json_merger.ipynb`
**Objective**: Integrate metadata and similarity scores into the final graph structure.

**Methodological steps**:
1. **Metadata integration**: Merge instance metadata from CSV files into graph nodes
2. **Similarity integration**: Add all similarity types to graph edges
3. **Data cleaning**: Remove edges pointing to instances without metadata or no longer present
4. **JSON export**: Produce clean, structured graph files for downstream applications

**Three-step process**:
- Step 1: Add metadata → `graph.json` + metadata → `graph_with_metadata.json`
- Step 2: Add similarities → `graph_similarities_with_metadata.json`
- Step 3: Clean data → `graph_similarities_with_metadata_cleaned.json`

## Workflow Pipeline

### Execution Order:

1. **Create the initial graph with Gephi**

2. **Data Preparation** (`mastodon_metadata_extractor.ipynb`)
	 - Filter raw data
	 - Extract instance metadata through API calls
	 - ⚠️ **Required first** - generates metadata required by subsequent notebooks

3. **Embedding Generation**:
	 - `node2vec.ipynb` - Network-structural embeddings
	 - `sentence_transformers_descr.ipynb` - Content embeddings
	 - `sentence_transformers_title.ipynb` - Title embeddings
  
4. **Embedding Combination** (`mixed_embeddings.ipynb`)
	 - Requires: Node2Vec + description embeddings
	 - Produces hybrid embeddings

5. **Similarity Calculation** (`json_similarities.ipynb`)
	 - Requires: all embedding types
	 - Computes pairwise similarities

6. **Graph Construction** (`json_merger.ipynb`)
	 - Requires: metadata + similarities
	 - Builds the final graph structure
  
## MastodonAtlas Integration

The graph produced by `json_merger.ipynb` can be imported directly into MastodonAtlas. The files `sentence_transformers_emb.pkl` and `title_emb.pkl` must be placed in the `backend` directory of `vis-graph`.
  
## Dependencies

```python
# Core libraries
pandas>=1.3.0
numpy>=1.20.0
torch>=1.9.0
networkx>=2.6.0

# NLP and embeddings
sentence-transformers>=2.0.0
transformers>=4.0.0

# Web scraping and API
requests>=2.25.0
beautifulsoup4>=4.9.0
regex>=2021.0.0

# Utilities
tqdm>=4.60.0
pickle
json
multiprocessing
```

## Output

### Final Graph JSON Format

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