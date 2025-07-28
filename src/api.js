

export async function searchByTopic(topic, k = 5, availableNodes = null, searchScope = 'both') {
    const body = { topic, k, search_scope: searchScope };
    if (availableNodes) {
      body.available_nodes = availableNodes;
    }
    
    const res = await fetch("http://localhost:5000/search_topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Topic search failed");
    return await res.json();
  }