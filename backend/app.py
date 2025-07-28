from flask import Flask, request, jsonify
import pickle
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow requests from your frontend

# Load description embeddings (main file)
with open("sentence_transformers_emb.pkl", "rb") as f:
    description_embeddings = pickle.load(f)
node_ids = list(description_embeddings.keys())
description_emb_matrix = np.stack([description_embeddings[nid] for nid in node_ids])
print(f"Loaded description embeddings for {len(description_embeddings)} nodes")

# Load title embeddings
title_embeddings = None
title_emb_matrix = None
try:
    with open("title_emb.pkl", "rb") as f:
        title_embeddings = pickle.load(f)
    # Create matrix with same node order as description embeddings
    title_emb_matrix = np.stack([title_embeddings.get(nid, np.zeros_like(list(title_embeddings.values())[0])) for nid in node_ids])
    print(f"Loaded title embeddings for {len(title_embeddings)} nodes")
except Exception as e:
    print(f"Warning: Could not load title embeddings: {e}")

# For 'both' searches, we'll combine title and description embeddings
# The general embeddings matrix points to descriptions for backward compatibility
emb_matrix = description_emb_matrix

model = SentenceTransformer("all-MiniLM-L6-v2")

@app.route("/search_topic", methods=["POST"])
def search_topic():
    data = request.json
    topic = data.get("topic")
    k = int(data.get("k", 5))
    available_nodes = data.get("available_nodes", None)
    search_scope = data.get("search_scope", "both")
    
    if not topic:
        return jsonify({"error": "No topic provided"}), 400
    
    print(f"Topic search: '{topic}' with scope '{search_scope}' (k={k})")
    
    # Encode the topic
    topic_emb = model.encode(topic)
    
    # Handle different search scopes using pre-computed embeddings
    if search_scope == 'title' and title_emb_matrix is not None:
        # Use pre-computed title embeddings
        print(f"Using pre-computed title embeddings")
        sims = cosine_similarity([topic_emb], title_emb_matrix)[0]
        all_results = [(node_ids[i], float(sims[i])) for i in range(len(node_ids))]
        all_results.sort(key=lambda x: x[1], reverse=True)
        
    elif search_scope == 'description':
        # Use pre-computed description embeddings (from sentence_transformers_emb.pkl)
        print(f"Using pre-computed description embeddings")
        sims = cosine_similarity([topic_emb], description_emb_matrix)[0]
        all_results = [(node_ids[i], float(sims[i])) for i in range(len(node_ids))]
        all_results.sort(key=lambda x: x[1], reverse=True)
        
    elif search_scope == 'both' and title_emb_matrix is not None:
        # Combine title and description similarities
        print(f"Using combined title + description embeddings")
        title_sims = cosine_similarity([topic_emb], title_emb_matrix)[0]
        desc_sims = cosine_similarity([topic_emb], description_emb_matrix)[0]
        # Average the similarities
        combined_sims = (title_sims + desc_sims) / 2
        all_results = [(node_ids[i], float(combined_sims[i])) for i in range(len(node_ids))]
        all_results.sort(key=lambda x: x[1], reverse=True)
        
    else:
        # Fallback to description embeddings (for invalid scope or missing title embeddings)
        print(f"Using description embeddings as fallback")
        sims = cosine_similarity([topic_emb], description_emb_matrix)[0]
        all_results = [(node_ids[i], float(sims[i])) for i in range(len(node_ids))]
        all_results.sort(key=lambda x: x[1], reverse=True)
    
    # Filter results if available_nodes is provided
    if available_nodes is not None:
        available_nodes_set = set(available_nodes)
        filtered_results = [(node_id, sim) for node_id, sim in all_results if node_id in available_nodes_set]
        # Take top k from filtered results
        top_results = filtered_results[:k]
    else:
        # Take top k from all results (original behavior)
        top_results = all_results[:k]
    
    # Format results
    results = [{"node_id": node_id, "similarity": similarity} for node_id, similarity in top_results]
    
    print(f"Returning {len(results)} results (filtered from {len(all_results)} total)")
    
    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)