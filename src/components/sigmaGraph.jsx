import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import defaultData from './graph_similarities_with_metadata_cleaned.json';
import { searchByTopic } from '../api';
import './sigmaGraph.css';

function normalize(value, min, max) {
  return (value - min) / (max - min);
}

export default function SigmaGraph() {
  const containerRef = useRef(null);
  const sigmaInstance = useRef(null);
  const graphRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [nodeFilter, setNodeFilter] = useState('');
  const [similarityMetric, setSimilarityMetric] = useState('node2vec_similarity');
  const [topK, setTopK] = useState(10);
  const nodeMapRef = useRef(new Map());
  const [topicInput, setTopicInput] = useState('');
  const [topicResults, setTopicResults] = useState([]);
  const [currentTopicQuery, setCurrentTopicQuery] = useState(''); // Store current topic query
  const [navigationHistory, setNavigationHistory] = useState([{ type: 'welcome' }]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [importedData, setImportedData] = useState(defaultData); // Preload with default data
  const [isLoading, setIsLoading] = useState(false);
  const [maxDegree, setMaxDegree] = useState(20);
  const fileInputRef = useRef();
  const [availableSimilarityMetrics, setAvailableSimilarityMetrics] = useState([]); // Dynamic similarity metrics
  const [useRealNodeSizes, setUseRealNodeSizes] = useState(true); // Toggle for real vs fixed node sizes
  const [isGraphLoaded, setIsGraphLoaded] = useState(false); // Track if graph is loaded
  const [topicSearchScope, setTopicSearchScope] = useState({ title: true, description: true }); // What to search in - checkboxes for title and description
  const highlightingStateRef = useRef({ selectedNodeId: null, topicResults: [] }); // Store highlighting state

  // Helper function to convert checkbox state to API format
  const getScopeString = useCallback((scope) => {
    const { title, description } = scope;
    if (title && description) return 'both';
    if (title) return 'title';
    if (description) return 'description';
    return 'both'; // fallback to both if nothing is selected
  }, []);

  // Function to calculate node size based on toggle setting
  const calculateNodeSize = useCallback((nodeId) => {
    const nodeData = nodeMapRef.current.get(nodeId);
    
    if (!useRealNodeSizes) {
      return 4; // Fixed size for all nodes
    }
    

    
    // Try different possible size property names
    const possibleSizes = [
      nodeData?.size,
      nodeData?.weight, 
      nodeData?.value,
      nodeData?.degree,
      nodeData?.attributes?.size,
      nodeData?.attributes?.weight,
      nodeData?.attributes?.value
    ];
    
    let rawSize = possibleSizes.find(s => typeof s === 'number' && !isNaN(s));
    
    if (typeof rawSize !== 'number' || isNaN(rawSize)) {
      // If no size data found, use degree from the graph as a proxy
      if (graphRef.current && graphRef.current.hasNode(nodeId)) {
        const degree = graphRef.current.getNodeAttribute(nodeId, 'degree');
        rawSize = degree ? Math.min(degree * 0.5 + 2, 10) : 4;
      } else {
        rawSize = 4; // Default fallback
      }
    }
    
    // Apply a scaling factor to make sizes more visible if they're too small
    // but preserve the relative differences between nodes
    if (rawSize <= 0) {
      return 1; // Very small nodes
    }
    
    // Scale very small values up, but preserve larger values and relationships
    if (rawSize < 1) {
      return Math.max(1, rawSize * 10); // Scale up small values
    }
    
    // For reasonable sizes, use them directly (but cap extremely large ones)
    return Math.min(rawSize, 20); // Cap at 20 to prevent huge nodes
  }, [useRealNodeSizes]);

  // Function to detect available similarity metrics from the data
  const detectAvailableSimilarityMetrics = useCallback((data) => {
    if (!data || !data.edges || data.edges.length === 0) {
      setAvailableSimilarityMetrics([]);
      return [];
    }

    const metricsSet = new Set();
    
    // Scan through edges to find all similarity-related attributes
    data.edges.forEach((edge) => {
      // Check edge.similarities object first (new structure)
      if (edge.similarities && typeof edge.similarities === 'object') {
        Object.keys(edge.similarities).forEach((key) => {
          if (typeof edge.similarities[key] === 'number' && 
              !isNaN(edge.similarities[key])) {
            metricsSet.add(key);
          }
        });
      }
      
      // Also check direct edge properties (fallback)
      Object.keys(edge).forEach((key) => {
        if (key.toLowerCase().includes('similarity') && 
            typeof edge[key] === 'number' && 
            !isNaN(edge[key])) {
          metricsSet.add(key);
        }
      });
    });

    const availableMetrics = Array.from(metricsSet).sort();
    
    // Create user-friendly options with labels
    const metricsWithLabels = availableMetrics.map(metric => {
      // Remove "similarity" from the end if present, then convert snake_case to Title Case
      const cleanMetric = metric.toLowerCase().endsWith('_similarity') 
        ? metric.slice(0, -11) // Remove "_similarity" (11 characters)
        : metric;
      
      const label = cleanMetric.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      return { value: metric, label: label };
    });
    
    setAvailableSimilarityMetrics(metricsWithLabels);
    return metricsWithLabels;
  }, []);



  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        // Validate that it has the required structure
        if (!jsonData.nodes || !jsonData.edges) {
          alert('Invalid graph file. Please upload a JSON file with "nodes" and "edges" arrays.');
          setIsLoading(false);
          return;
        }

        setImportedData(jsonData);
        // Clear the file input
        event.target.value = '';
      } catch (error) {
        alert('Error parsing JSON file. Please make sure it\'s a valid JSON file.');
        console.error('JSON parse error:', error);
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const updateMaxDegree = useCallback(() => {
    if (!graphRef.current) {
      setMaxDegree(20);
      return;
    }
    let maxDeg = 0;
    graphRef.current.forEachNode((node) => {
      const deg = graphRef.current.getNodeAttribute(node, 'degree');
      if (typeof deg === 'number' && deg > maxDeg) maxDeg = deg;
    });
    setMaxDegree(maxDeg > 0 ? maxDeg : 20);
  }, []);

  const loadGraphData = useCallback(() => {
    if (!importedData) {
      return;
    }
    
    // Reset state
    setSelectedNode(null);
    setSearchInput('');
    setTopicResults([]);
    setCurrentTopicQuery('');
    setNavigationHistory([{ type: 'welcome' }]);
    setCurrentHistoryIndex(0);
    nodeMapRef.current.clear();
    
    // Reset highlighting state
    highlightingStateRef.current = { selectedNodeId: null, topicResults: [] };

    // Kill existing sigma instance
    if (sigmaInstance.current) {
      sigmaInstance.current.kill();
      sigmaInstance.current = null;
      setIsGraphLoaded(false); // Mark graph as unloaded
    }

    // Create new graph
    const graph = new Graph();
    graphRef.current = graph;

    // Store original positions and normalize them
    const xs = importedData.nodes.map(n => n.x);
    const ys = importedData.nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Create nodes with enhanced properties
    importedData.nodes.forEach((node) => {
      nodeMapRef.current.set(node.id, node);
      const normalizedX = normalize(node.x, minX, maxX);
      const normalizedY = normalize(node.y, minY, maxY);
      
      graph.addNode(node.id, {
        label: node.id,
        x: normalizedX,
        y: normalizedY,
        size: calculateNodeSize(node.id),
        color: node.color || '#3388AA',
        originalColor: node.color || '#3388AA',
        degree: 0,
        hidden: false,
        type: 'circle',
        highlighted: false
      });
    });

    // Create edges with enhanced properties
    importedData.edges.forEach((edge) => {
      if (!graph.hasEdge(edge.source, edge.target)) {
        graph.addEdge(edge.source, edge.target, {
          size: Math.max(0.1, Math.min(0.5, edge.size || 0.1)),
          color: edge.color || '#bbbbbb',
          originalColor: edge.color || '#bbbbbb',
          type: 'line',
          attributes: edge.attributes || {}
        });
        
        // Update node degrees
        graph.updateNodeAttribute(edge.source, 'degree', (degree) => degree + 1);
        graph.updateNodeAttribute(edge.target, 'degree', (degree) => degree + 1);
      }
    });

    // Initialize Sigma with enhanced settings
    if (!containerRef.current) {
      console.error('Container not found!');
      setIsLoading(false);
      return;
    }
    
    sigmaInstance.current = new Sigma(graph, containerRef.current, {
      renderLabels: true, // Always show labels
      renderEdgeLabels: false,
      defaultNodeColor: '#3388AA',
      defaultEdgeColor: '#cccccc',
      labelSize: 12,
      labelThreshold: 3,
      zoomingRatio: 1.2,

      nodeReducer: (node, data) => {
        const res = { ...data };
        
        // Keep highlighted nodes as-is, just use color for prominence
        return res;
      },
      edgeReducer: (edge, data) => {
        const res = { ...data };
        
        // Don't override manual highlighting
        if (data.color === '#e0e0e0' || data.color === '#ff3b30') {
          return res;
        }
        
        return res;
      }
    });
    
    setIsLoading(false);
    setIsGraphLoaded(true); // Mark graph as loaded
    updateMaxDegree(); // Update max degree after loading graph

    // Enhanced event listeners
    sigmaInstance.current.on('clickNode', (event) => {
      const nodeId = event.node;
      const nodeData = nodeMapRef.current.get(nodeId);
      setSelectedNode(nodeData);
      
      // Add to navigation history
      addToHistory({ type: 'nodeDetails', data: nodeData, nodeId: nodeId });
    });

    sigmaInstance.current.on('clickStage', () => {
      setSelectedNode(null);
      
      // Only add welcome state if we're not already on welcome
      if (currentHistoryIndex === 0 || navigationHistory[currentHistoryIndex]?.type !== 'welcome') {
        addToHistory({ type: 'welcome' });
      }
    });
  }, [importedData, showLabels, updateMaxDegree]);

  const highlightConnectedNodes = useCallback((nodeId) => {
    if (!graphRef.current || !sigmaInstance.current || !nodeId) return;
    
    const graph = graphRef.current;
    
    // Get connected nodes
    const connectedNodes = new Set();
    graph.forEachEdge((edge) => {
      if (graph.extremities(edge).includes(nodeId)) {
        const [source, target] = graph.extremities(edge);
        if (source !== nodeId) connectedNodes.add(source);
        if (target !== nodeId) connectedNodes.add(target);
      }
    });
    
    // Put all nodes and edges in background first
    graph.forEachNode((node) => {
      graph.setNodeAttribute(node, 'color', '#cccccc'); // Gray background
      graph.setNodeAttribute(node, 'highlighted', false); // Not highlighted
    });
    
    graph.forEachEdge((edge) => {
      graph.setEdgeAttribute(edge, 'color', '#e0e0e0'); // Light gray background
      graph.setEdgeAttribute(edge, 'size', 0.05); // Very thin
    });
    
    // Highlight connected nodes with more prominence
    connectedNodes.forEach((connectedNodeId) => {
      graph.setNodeAttribute(connectedNodeId, 'color', '#ff9500'); // Bright orange
      graph.setNodeAttribute(connectedNodeId, 'highlighted', true); // Mark as highlighted
    });
    
    // Highlight connected edges with more prominence
    graph.forEachEdge((edge) => {
      if (graph.extremities(edge).includes(nodeId)) {
        graph.setEdgeAttribute(edge, 'color', '#ff3b30'); // Bright red
        graph.setEdgeAttribute(edge, 'size', 2.5); // Much thicker edge
      }
    });
    
    // Highlight the selected node with maximum prominence
    graph.setNodeAttribute(nodeId, 'color', '#ff3b30'); // Bright red
    graph.setNodeAttribute(nodeId, 'highlighted', true); // Mark as highlighted
    
    sigmaInstance.current.refresh();
  }, []);

  const resetHighlighting = useCallback(() => {
    if (!graphRef.current || !sigmaInstance.current) return;
    
    const graph = graphRef.current;
    
    // Reset all nodes to original appearance
    graph.forEachNode((node) => {
      graph.setNodeAttribute(node, 'color', graph.getNodeAttribute(node, 'originalColor'));
      graph.setNodeAttribute(node, 'size', calculateNodeSize(node));
      graph.setNodeAttribute(node, 'highlighted', false); // Remove highlighting
    });
    
    // Reset all edges to original appearance
    graph.forEachEdge((edge) => {
      graph.setEdgeAttribute(edge, 'color', graph.getEdgeAttribute(edge, 'originalColor'));
      graph.setEdgeAttribute(edge, 'size', Math.max(0.1, Math.min(0.5, 0.1)));
    });
    
    sigmaInstance.current.refresh();
  }, [calculateNodeSize]);

  // Centralized function to apply all highlighting based on current state
  const applyCurrentHighlighting = useCallback(() => {
    if (!graphRef.current || !sigmaInstance.current) return;

    const { selectedNodeId, topicResults } = highlightingStateRef.current;
    
    // Apply node selection highlighting if there's a selected node
    if (selectedNodeId) {
      highlightConnectedNodes(selectedNodeId);
    } else if (topicResults.length > 0) {
      // Apply topic highlighting if there are topic results but no selected node
      const graph = graphRef.current;
      
      // Reset all nodes first
      graph.forEachNode((node) => {
        graph.setNodeAttribute(node, 'color', graph.getNodeAttribute(node, 'originalColor'));
        graph.setNodeAttribute(node, 'size', calculateNodeSize(node));
        graph.setNodeAttribute(node, 'highlighted', false);
      });

      // Highlight topic results
      const actualGraphNodes = new Set();
      graph.forEachNode((node) => {
        actualGraphNodes.add(node);
      });

      topicResults.forEach((item) => {
        if (actualGraphNodes.has(item.node_id)) {
          graph.setNodeAttribute(item.node_id, 'color', '#e67e22');
          graph.setNodeAttribute(item.node_id, 'highlighted', true);
        }
      });

      sigmaInstance.current.refresh();
    } else {
      // No highlighting needed, reset to default
      resetHighlighting();
    }
  }, [highlightConnectedNodes, resetHighlighting, calculateNodeSize]);

  useEffect(() => {
    if (importedData) {
      loadGraphData();
      // Detect available similarity metrics from the new data
      const metrics = detectAvailableSimilarityMetrics(importedData);
      // Validate current metric and switch if needed
      if (metrics.length > 0) {
        const currentMetricExists = metrics.some(m => m.value === similarityMetric);
        if (!currentMetricExists) {
          setSimilarityMetric(metrics[0].value);
        }
      }
    }
  }, [importedData, loadGraphData, detectAvailableSimilarityMetrics]);

  // Effect to load default data on component mount
  useEffect(() => {
    // The importedData is already set with defaultData, so loadGraphData will be called automatically
    // Also detect similarity metrics from default data
    const metrics = detectAvailableSimilarityMetrics(defaultData);
    // Validate current metric and switch if needed (inline to avoid dependency issues)
    if (metrics.length > 0) {
      const currentMetricExists = metrics.some(m => m.value === similarityMetric);
      if (!currentMetricExists) {
        setSimilarityMetric(metrics[0].value);
      }
    }
  }, [detectAvailableSimilarityMetrics]); // Run once on mount and when detectAvailableSimilarityMetrics changes

  // Update maxDegree whenever the graph is loaded or changed
  useEffect(() => {
    updateMaxDegree();
  }, [importedData, updateMaxDegree]);

  // Removed automatic loading - users must import a JSON file to see a graph

  // Effect to handle highlighting when selectedNode changes
  useEffect(() => {
    console.log('selectedNode changed to:', selectedNode?.id || null);
    
    // Update highlighting state
    highlightingStateRef.current.selectedNodeId = selectedNode?.id || null;
    console.log('Updated highlighting state:', highlightingStateRef.current);
    
    // Apply highlighting immediately
    applyCurrentHighlighting();
  }, [selectedNode, applyCurrentHighlighting]);

  // Effect to handle showLabels changes - Commented out: Always show labels
  /*
  useEffect(() => {
    if (sigmaInstance.current) {
      console.log('Show labels changing to:', showLabels);
      console.log('Current highlighting state:', highlightingStateRef.current);
      
      sigmaInstance.current.setSetting('renderLabels', showLabels);
      
      // Re-apply highlighting after Sigma processes the setting change
      // Use requestAnimationFrame to ensure it happens after Sigma's refresh
      requestAnimationFrame(() => {
        const { selectedNodeId, topicResults } = highlightingStateRef.current;
        
        if (selectedNodeId) {
          highlightConnectedNodes(selectedNodeId);
        } else if (topicResults.length > 0) {
          // Apply topic highlighting
          const graph = graphRef.current;
          if (graph && sigmaInstance.current) {
            // Reset all nodes first
            graph.forEachNode((node) => {
              graph.setNodeAttribute(node, 'color', graph.getNodeAttribute(node, 'originalColor'));
              graph.setNodeAttribute(node, 'size', calculateNodeSize(node));
              graph.setNodeAttribute(node, 'highlighted', false);
            });

            // Reset all edges
            graph.forEachEdge((edge) => {
              graph.setEdgeAttribute(edge, 'color', graph.getEdgeAttribute(edge, 'originalColor'));
              graph.setEdgeAttribute(edge, 'size', Math.max(0.1, Math.min(0.5, 0.1)));
            });

            // Highlight topic results
            const actualGraphNodes = new Set();
            graph.forEachNode((node) => {
              actualGraphNodes.add(node);
            });

            topicResults.forEach((item) => {
              if (actualGraphNodes.has(item.node_id)) {
                graph.setNodeAttribute(item.node_id, 'color', '#e67e22');
                graph.setNodeAttribute(item.node_id, 'highlighted', true);
              }
            });

            sigmaInstance.current.refresh();
          }
        }
      });
    }
  }, [showLabels, highlightConnectedNodes, calculateNodeSize]);
  */

  // Effect to re-apply highlighting when useRealNodeSizes changes
  useEffect(() => {
    // Re-apply current highlighting after node size setting change
    if (isGraphLoaded) {
      const currentSelectedNodeId = highlightingStateRef.current.selectedNodeId;
      if (currentSelectedNodeId && graphRef.current && sigmaInstance.current) {
        highlightConnectedNodes(currentSelectedNodeId);
      }
    }  
  }, [useRealNodeSizes, isGraphLoaded]);

  // Ref to track previous topK value
  const prevTopKRef = useRef(topK);

  // Effect to re-run topic search when topK changes
  useEffect(() => {
    // Only re-run if topK specifically changed AND we have an active topic search
    const topKChanged = prevTopKRef.current !== topK;
    prevTopKRef.current = topK;
    
    if (topKChanged && currentTopicQuery && topicResults.length > 0 && graphRef.current && sigmaInstance.current) {
      const rerunTopicSearch = async () => {
        try {
          // Get available nodes from current graph
          const availableNodes = [];
          graphRef.current.forEachNode((node) => {
            availableNodes.push(node);
          });
          
          const results = await searchByTopic(currentTopicQuery, topK, availableNodes, getScopeString(topicSearchScope));
          setTopicResults(results);
          
          // Update highlighting state
          highlightingStateRef.current.topicResults = results;
          
          // Update current history entry if it's a topic result
          if (navigationHistory[currentHistoryIndex]?.type === 'topicResults') {
            const updatedHistory = [...navigationHistory];
            updatedHistory[currentHistoryIndex] = {
              ...updatedHistory[currentHistoryIndex],
              data: results,
              topK: topK
            };
            setNavigationHistory(updatedHistory);
          }

          // Apply current highlighting (this will handle both topic and node selection)
          applyCurrentHighlighting();
        } catch (e) {
          console.error("Failed to re-run topic search:", e);
        }
      };

      rerunTopicSearch();
    }
  }, [currentTopicQuery]); // Only run when currentTopicQuery changes, topK is tracked manually

  // Effect to update node sizes when toggle changes
  useEffect(() => {
    if (graphRef.current && sigmaInstance.current && isGraphLoaded) {
      const graph = graphRef.current;
      
      // Update all node sizes while preserving highlighting
      graph.forEachNode((nodeId) => {
        graph.setNodeAttribute(nodeId, 'size', calculateNodeSize(nodeId));
      });
      
      // If there's a selected node, re-apply highlighting to preserve the visual state
      if (selectedNode) {
        highlightConnectedNodes(selectedNode.id);
      } else {
        sigmaInstance.current.refresh();
      }
    }
  }, [useRealNodeSizes, calculateNodeSize, isGraphLoaded, selectedNode]);

  const handleSearch = () => {
    if (!searchInput) return;
    
    // Check if graph is loaded first
    if (!sigmaInstance.current || !graphRef.current || !isGraphLoaded) {
      alert("No graph data loaded. Please import a JSON file first.");
      return;
    }

    if (!importedData || !importedData.nodes) {
      alert("No graph data loaded. Please import a JSON file first.");
      return;
    }
    
    const foundNode = importedData.nodes.find(n => 
      n.id.toLowerCase().includes(searchInput.toLowerCase())
    );
    
    if (foundNode) {
      const sigma = sigmaInstance.current;
      const nodePosition = sigma.getNodeDisplayData(foundNode.id);
      
      sigma.getCamera().animate({
        x: nodePosition.x,
        y: nodePosition.y,
        ratio: 0.1
      }, {
        duration: 1000
      });
      
      const nodeData = nodeMapRef.current.get(foundNode.id);
      setSelectedNode(nodeData);
      
      // Add to navigation history
      addToHistory({ type: 'nodeDetails', data: nodeData, nodeId: foundNode.id });
    } else {
      alert("Node not found.");
    }
  };

  const filterNodes = () => {
    if (!graphRef.current || !sigmaInstance.current || !isGraphLoaded) {
      alert("No graph loaded. Please import a JSON file first.");
      return;
    }
    
    const graph = graphRef.current;
    
    if (!nodeFilter) {
      // Show all nodes
      graph.forEachNode((node) => {
        graph.setNodeAttribute(node, 'hidden', false);
      });
    } else {
      // Filter nodes based on degree
      const minDegree = parseInt(nodeFilter) || 0;
      graph.forEachNode((node) => {
        const degree = graph.getNodeAttribute(node, 'degree');
        graph.setNodeAttribute(node, 'hidden', degree < minDegree);
      });
    }
    
    // Re-apply node selection highlighting if there's a selected node
    // This preserves highlighting when filtering nodes
    if (selectedNode) {
      highlightConnectedNodes(selectedNode.id);
    } else {
      sigmaInstance.current.refresh();
    }
  };

  const getSimilarNodes = () => {
    if (!importedData || !importedData.edges) {
      return [];
    }
    
    if (!selectedNode) {
      return [];
    }
  
    const similarNodesMap = new Map();
  
    importedData.edges.forEach((edge) => {
      let otherNode = null;
  
      if (edge.source === selectedNode.id) {
        otherNode = edge.target;
      } else if (edge.target === selectedNode.id) {
        otherNode = edge.source;
      }
  
      if (!otherNode) return;
  
      // Try to get similarity from edge.similarities first, then edge attributes, then direct edge properties
      const similarityRaw = edge.similarities?.[similarityMetric] || edge.attributes?.[similarityMetric] || edge[similarityMetric];
  
      if (typeof similarityRaw !== 'number') {
        // Skip edges without the selected similarity metric
        return;
      }
  
      // Use the highest similarity value if the node appears multiple times
      const existingSimilarity = similarNodesMap.get(otherNode)?.similarity || 0;
      if (similarityRaw > existingSimilarity) {
        similarNodesMap.set(otherNode, {
          nodeId: otherNode,
          similarity: similarityRaw,
          edgeAttributes: edge.attributes || {}
        });
      }
    });
  
    const similarNodes = Array.from(similarNodesMap.values());
    
    return similarNodes
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  };  
  

  const handleSimilarNodeClick = (nodeId) => {
    const nodeData = nodeMapRef.current.get(nodeId);
    if (nodeData && sigmaInstance.current) {
      const sigma = sigmaInstance.current;
      const nodePosition = sigma.getNodeDisplayData(nodeId);
      
      sigma.getCamera().animate({
        x: nodePosition.x,
        y: nodePosition.y,
        ratio: 0.1
      }, {
        duration: 1000
      });
      
      setSelectedNode(nodeData);
      
      // Add to navigation history
      addToHistory({ type: 'nodeDetails', data: nodeData, nodeId: nodeId });
    }
  };

  const handleTopicResultClick = (nodeId) => {
    // Check if node exists in the graph
    if (!graphRef.current || !graphRef.current.hasNode(nodeId)) {
      alert(`Node "${nodeId}" not found in the graph.`);
      return;
    }
    
    const nodeData = nodeMapRef.current.get(nodeId);
    if (!nodeData) {
      alert(`Node data for "${nodeId}" not found.`);
      return;
    }
    
    if (!sigmaInstance.current) {
      alert('Graph not ready. Please try again.');
      return;
    }
    
    try {
      const sigma = sigmaInstance.current;
      const nodePosition = sigma.getNodeDisplayData(nodeId);
      
      if (!nodePosition) {
        alert(`Could not find position for node "${nodeId}".`);
        return;
      }
      
      // Animate camera to the node
      sigma.getCamera().animate({
        x: nodePosition.x,
        y: nodePosition.y,
        ratio: 0.1
      }, {
        duration: 1000
      });
      
      // Set as selected node to show details
      setSelectedNode(nodeData);
      
      // Clear topic results to show the node details instead
      setTopicResults([]);
      highlightingStateRef.current.topicResults = [];
      
      addToHistory({ type: 'nodeDetails', data: nodeData, nodeId: nodeId });
    } catch (error) {
      console.error('Error handling topic result click:', error);
      alert('Error selecting node. Please try again.');
    }
  };

  const similarNodes = useMemo(() => getSimilarNodes(), [selectedNode, similarityMetric, topK, importedData, availableSimilarityMetrics]);

  const addToHistory = (state) => {
    // Don't add duplicate welcome states
    if (state.type === 'welcome' && 
        navigationHistory.length > 0 && 
        navigationHistory[navigationHistory.length - 1]?.type === 'welcome') {
      return;
    }
    
    const newHistory = navigationHistory.slice(0, currentHistoryIndex + 1);
    newHistory.push(state);
    setNavigationHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  };

  const goBack = () => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      const previousState = navigationHistory[newIndex];
      restoreState(previousState);
    } else {
      // Go back to welcome state
      setSelectedNode(null);
      setTopicResults([]);
      highlightingStateRef.current = { selectedNodeId: null, topicResults: [] };
    }
  };

  const goForward = () => {
    if (currentHistoryIndex < navigationHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      const nextState = navigationHistory[newIndex];
      restoreState(nextState);
    }
  };

  const restoreState = async (state) => {
    if (state.type === 'welcome') {
      setSelectedNode(null);
      setTopicResults([]);
      setCurrentTopicQuery('');
      highlightingStateRef.current = { selectedNodeId: null, topicResults: [] };
    } else if (state.type === 'topicResults') {
      setSelectedNode(null);
      
      // Restore the search scope from state if available
      if (state.scopeState) {
        // New format with checkbox state
        setTopicSearchScope(state.scopeState);
      } else if (state.searchScope) {
        const scopeState = {
          title: state.searchScope === 'title' || state.searchScope === 'both',
          description: state.searchScope === 'description' || state.searchScope === 'both'
        };
        setTopicSearchScope(scopeState);
      }
      
      // If we have a stored query and topK has changed, re-run the search
      if (state.query && state.topK !== topK && isGraphLoaded) {
        try {
          const availableNodes = [];
          graphRef.current.forEachNode((node) => {
            availableNodes.push(node);
          });
          
          const results = await searchByTopic(state.query, topK, availableNodes, state.searchScope || getScopeString(topicSearchScope));
          setTopicResults(results);
          setCurrentTopicQuery(state.query);
          
          // Update highlighting state
          highlightingStateRef.current.topicResults = results;
          
          // Apply current highlighting (this will handle both topic and node selection)
          applyCurrentHighlighting();
        } catch (e) {
          console.error("Failed to restore topic search:", e);
          // Fallback to stored results
          setTopicResults(state.data);
          setCurrentTopicQuery(state.query || '');
        }
      } else {
        // Use stored results
        setTopicResults(state.data);
        setCurrentTopicQuery(state.query || '');
      }
    } else if (state.type === 'nodeDetails') {
      setSelectedNode(state.data);
      setTopicResults([]);
      setCurrentTopicQuery('');
      highlightingStateRef.current = { selectedNodeId: state.data?.id || null, topicResults: [] };
      if (state.nodeId) {
        // Animate to the node position
        const sigma = sigmaInstance.current;
        if (sigma) {
          const nodePosition = sigma.getNodeDisplayData(state.nodeId);
          if (nodePosition) {
            sigma.getCamera().animate({
              x: nodePosition.x,
              y: nodePosition.y,
              ratio: 0.1
            }, {
              duration: 1000
            });
          }
        }
      }
    }
  };

  // Handler for topic search
  const handleTopicSearch = async () => {
    if (!topicInput) return;
    
    // Check if at least one search scope is selected
    if (!topicSearchScope.title && !topicSearchScope.description) {
      alert("Please select at least one field to search in (Title or Description).");
      return;
    }
    
    // Check if graph is loaded first
    if (!sigmaInstance.current || !graphRef.current || !isGraphLoaded) {
      alert("No graph data loaded. Please import a JSON file first.");
      return;
    }
    
    setSelectedNode(null);
    try {
      // Get available nodes from current graph
      const availableNodes = [];
      graphRef.current.forEachNode((node) => {
        availableNodes.push(node);
      });
      
      const results = await searchByTopic(topicInput, topK, availableNodes, getScopeString(topicSearchScope));
      setTopicResults(results);
      setCurrentTopicQuery(topicInput); // Store the query for future re-runs
      addToHistory({ type: 'topicResults', data: results, query: topicInput, topK: topK, searchScope: getScopeString(topicSearchScope), scopeState: topicSearchScope });

      // Update highlighting state
      highlightingStateRef.current.topicResults = results;
      
      // Apply current highlighting (this will handle both topic and node selection)
      applyCurrentHighlighting();
    } catch (e) {
      alert("Topic search failed: " + e.message);
    }
  };

  const manualExportGraphAsPNG = () => {
    if (!graphRef.current || !containerRef.current) {
      alert("Graph is not ready.");
      return;
    }
  
    const graph = graphRef.current;
    const container = containerRef.current;
    const width = container.offsetWidth || 1024;
    const height = container.offsetHeight || 768;
    
    // Handle high DPI displays to prevent blurriness
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;
  
    // Create a 2D canvas with high DPI support
    const canvas = document.createElement("canvas");
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
  
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      alert("Could not get canvas context.");
      return;
    }
    
    // Scale the drawing context to match the device pixel ratio
    ctx.scale(dpr, dpr);
  
    // Fill background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    
    // Get current highlighting state
    const { selectedNodeId, topicResults } = highlightingStateRef.current;
    const highlightedNodes = new Set();
    
    // Determine which nodes should be highlighted
    if (selectedNodeId) {
      // Add the selected node
      highlightedNodes.add(selectedNodeId);
      // Add connected nodes
      graph.forEachEdge((edge) => {
        if (graph.extremities(edge).includes(selectedNodeId)) {
          const [source, target] = graph.extremities(edge);
          if (source !== selectedNodeId) highlightedNodes.add(source);
          if (target !== selectedNodeId) highlightedNodes.add(target);
        }
      });
    } else if (topicResults.length > 0) {
      // Add topic result nodes
      topicResults.forEach((item) => {
        if (graph.hasNode(item.node_id)) {
          highlightedNodes.add(item.node_id);
        }
      });
    }
  
    // Draw background edges first
    graph.forEachEdge((edge, attr, source, target) => {
      const sx = graph.getNodeAttribute(source, "x") * width;
      const sy = graph.getNodeAttribute(source, "y") * height;
      const tx = graph.getNodeAttribute(target, "x") * width;
      const ty = graph.getNodeAttribute(target, "y") * height;
      
      // Check if this edge should be highlighted
      const isHighlightedEdge = selectedNodeId && graph.extremities(edge).includes(selectedNodeId);
      
      // Only draw background edges here
      if (highlightedNodes.size === 0 || !isHighlightedEdge) {
        let edgeColor = attr.color || "#cccccc";
        let edgeWidth = attr.size || 1;
        
        if (highlightedNodes.size > 0) {
          // Background edge when highlighting is active
          edgeColor = "#e0e0e0";
          edgeWidth = 0.05;
        }

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = edgeWidth;
        ctx.stroke();
      }
    });

    // Draw background nodes
    graph.forEachNode((node, attr) => {
      const x = attr.x * width;
      const y = attr.y * height;
      let radius = attr.size || 4;
      let nodeColor = attr.color || "#3388AA";
      
      // Only draw background nodes here
      if (highlightedNodes.size === 0 || !highlightedNodes.has(node)) {
        if (highlightedNodes.size > 0) {
          // Background node when highlighting is active
          nodeColor = "#cccccc";
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColor;
        ctx.fill();
        
        // Add a subtle border to make nodes more defined
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });

    // Draw highlighted edges on top
    if (highlightedNodes.size > 0) {
      graph.forEachEdge((edge, attr, source, target) => {
        const sx = graph.getNodeAttribute(source, "x") * width;
        const sy = graph.getNodeAttribute(source, "y") * height;
        const tx = graph.getNodeAttribute(target, "x") * width;
        const ty = graph.getNodeAttribute(target, "y") * height;
        
        // Check if this edge should be highlighted
        const isHighlightedEdge = selectedNodeId && graph.extremities(edge).includes(selectedNodeId);
        
        // Only draw highlighted edges here
        if (isHighlightedEdge) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = "#ff3b30"; // Bright red for highlighted edges
          ctx.lineWidth = 2.5; // Thick highlighted edges
          ctx.stroke();
        }
      });
    }

    // Draw highlighted nodes on top
    if (highlightedNodes.size > 0) {
      graph.forEachNode((node, attr) => {
        if (highlightedNodes.has(node)) {
          const x = attr.x * width;
          const y = attr.y * height;
          let radius = attr.size || 4;
          let nodeColor = attr.color || "#3388AA";
          
          // Determine highlighted node color
          if (node === selectedNodeId) {
            // Selected node - most prominent
            nodeColor = "#ff3b30";
          } else if (selectedNodeId) {
            // Connected node when a node is selected
            nodeColor = "#ff9500";
          } else {
            // Topic result node
            nodeColor = "#e67e22";
          }

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = nodeColor;
          ctx.fill();
          
          // Add a subtle border to make nodes more defined
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.strokeStyle = "rgba(0,0,0,0.1)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    }
  
    // Export PNG
    const dataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `graph-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to zoom in
  const zoomIn = () => {
    if (!sigmaInstance.current) return;
    
    const camera = sigmaInstance.current.getCamera();
    const currentRatio = camera.getState().ratio;
    camera.animate({
      ratio: currentRatio * 0.5
    }, {
      duration: 500
    });
  };

  // Function to zoom out
  const zoomOut = () => {
    if (!sigmaInstance.current) return;
    
    const camera = sigmaInstance.current.getCamera();
    const currentRatio = camera.getState().ratio;
    camera.animate({
      ratio: currentRatio * 2
    }, {
      duration: 500
    });
  };

  // Function to restore original zoom and recenter
  const restoreZoom = () => {
    if (!sigmaInstance.current) return;
    
    const camera = sigmaInstance.current.getCamera();
    camera.animate({
      x: 0.5,
      y: 0.5,
      ratio: 1
    }, {
      duration: 1000
    });
  };

  return (
    <div className="sigma-graph-container">
      {/* Control Panel */}
      <div className="control-panel">
        {/* Logo */}
        <div className="logo-container">
          <img src="/logo.png" alt="MastodonAtlas Logo" className="logo-image" />
          <h1 className="app-title" style={{ 
            color: '#2c3e50', 
            fontFamily: 'Arial, sans-serif', 
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '0 0 0 12px'
          }}>
            MastodonAtlas
          </h1>
        </div>

        {/* Search */}
        <div className="control-group">
          <input
            type="text"
            value={searchInput}
            placeholder="Search nodes..."
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
            disabled={!isGraphLoaded}
          />
          <button onClick={handleSearch} className="search-button" disabled={!isGraphLoaded}>
            🔍
          </button>
        </div>

        {/* Topic Search */}
        <div className="control-group">
          <input
              type="text"
              value={topicInput}
              placeholder="Search by topic..."
              onChange={e => setTopicInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleTopicSearch()}
              className="search-input"
              disabled={!isGraphLoaded}
              style={{ flex: '1' }}
            />
            <button onClick={handleTopicSearch} className="topic-search-button" disabled={!isGraphLoaded}>
              🔎
            </button>
            
            <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={topicSearchScope.title}
                  onChange={(e) => setTopicSearchScope(prev => ({ ...prev, title: e.target.checked }))}
                  className="checkbox-input"
                  disabled={!isGraphLoaded}
                />
                Title
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={topicSearchScope.description}
                  onChange={(e) => setTopicSearchScope(prev => ({ ...prev, description: e.target.checked }))}
                  className="checkbox-input"
                  disabled={!isGraphLoaded}
                />
                Description
              </label>
        </div>



        <div className="control-group" style={{ marginLeft: 'auto', justifyContent: 'flex-end' }}>
          <input
            type="file"
            id="file-upload"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="import-button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Import a different JSON graph file"
          >
            📁 Import
          </button>
          {isLoading && (
            <div className="loading-indicator">
              <span className="loading-spinner">⏳</span>
            </div>
          )}
          <button
            onClick={manualExportGraphAsPNG}
            className="export-button"
            title="Export the graph as a PNG image"
          >
            📸 Export
          </button>
        </div>

      </div>

      {/* Data Panel */}
      <div className="data-panel">
        {/* Filter */}
        <div className="control-group">
          <label className="control-label">Min Connections:</label>
          <input
            type="range"
            min="0"
            max={maxDegree}
            step="1"
            value={nodeFilter || 0}
            onChange={e => {
              setNodeFilter(e.target.value);
              filterNodes();
            }}
            className="number-input number-input-medium"
            style={{ width: '120px' }}
            disabled={!isGraphLoaded}
          />
          <input
            type="number"
            min="0"
            max={maxDegree}
            value={nodeFilter || 0}
            onChange={e => {
              const value = Math.max(0, Math.min(maxDegree, parseInt(e.target.value) || 0));
              setNodeFilter(value.toString());
              filterNodes();
            }}
            className="number-input number-input-small"
            style={{ width: '80px' }}
            disabled={!isGraphLoaded}
          />
        </div>

        {/* Similarity Controls */}
        <div className="control-group">
          <label className="control-label">
            Similarity:
          </label>
          <select
            value={similarityMetric}
            onChange={(e) => setSimilarityMetric(e.target.value)}
            className="select-dropdown"
            disabled={!isGraphLoaded || availableSimilarityMetrics.length === 0}
            title={availableSimilarityMetrics.length === 0 
              ? "No similarity measures found in the current graph data" 
              : `Choose from ${availableSimilarityMetrics.length} available similarity measures`
            }
          >
            {availableSimilarityMetrics.length > 0 ? (
              availableSimilarityMetrics.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))
            ) : (
              <option value="">No similarity measures available</option>
            )}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Top K:</label>
          <input
            type="number"
            value={topK}
            min="1"
            max="50"
            onChange={(e) => setTopK(parseInt(e.target.value) || 10)}
            className="number-input number-input-small"
            style={{ width: '70px' }}
          />
        </div>

        {/* Labels Toggle - Commented out: Always show labels */}
        {/*
        <div className="control-group">
          <label className="control-label">Show Labels:</label>
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`toggle-button ${showLabels ? 'toggle-active' : 'toggle-inactive'}`}
            title={showLabels ? 'Hide node labels' : 'Show node labels'}
          >
            {showLabels ? 'ON' : 'OFF'}
          </button>
        </div>
        */}

        {/* Node Size Toggle */}
        <div className="control-group">
          <label className="control-label">Node Sizes:</label>
          <button
            onClick={() => setUseRealNodeSizes(!useRealNodeSizes)}
            className={`toggle-button ${useRealNodeSizes ? 'toggle-active' : 'toggle-inactive'}`}
            title={useRealNodeSizes 
              ? 'Using actual node sizes from data (scaled for visibility)' 
              : 'Using fixed uniform size for all nodes'
            }
            disabled={!isGraphLoaded}
          >
            {useRealNodeSizes ? 'REAL' : 'FIXED'}
          </button>
        </div>

        {/* Navigation Buttons - Only show after first action */}
        {(currentHistoryIndex > 0 || navigationHistory.length > 1) && (
          <div className="control-group" style={{ justifyContent: 'flex-end', marginLeft: 'auto' }}>
            <button 
              onClick={goBack} 
              disabled={currentHistoryIndex <= 0}
              className="nav-button back-button"
              title="Go back to previous view"
              style={{ 
                fontSize: '16px', 
                padding: '8px 16px', 
                marginRight: '8px',
                minWidth: '60px',
                height: '40px',
                borderRadius: '20px'
              }}
            >
             ↶
            </button>
            <button 
              onClick={goForward} 
              disabled={currentHistoryIndex >= navigationHistory.length - 1}
              className="nav-button forward-button"
              title="Go forward to next view"
              style={{ 
                fontSize: '16px', 
                padding: '8px 16px',
                minWidth: '60px',
                height: '40px',
                borderRadius: '20px'
              }}
            >
              ↷
            </button>
          </div>
        )}

      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Graph Container */}
        <div className="graph-container">
          <div
            ref={containerRef}
            className="graph-canvas"
          />
          {isGraphLoaded && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <button
                onClick={zoomIn}
                className="graph-control-button"
                title="Zoom In"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  color: '#2c3e50',
                  border: '2px solid #e1e8ed',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f8f9fa';
                  e.target.style.borderColor = '#3498db';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.95)';
                  e.target.style.borderColor = '#e1e8ed';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                ➕
              </button>
              
              <button
                onClick={zoomOut}
                className="graph-control-button"
                title="Zoom Out"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  color: '#2c3e50',
                  border: '2px solid #e1e8ed',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f8f9fa';
                  e.target.style.borderColor = '#3498db';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.95)';
                  e.target.style.borderColor = '#e1e8ed';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                ➖
              </button>
              
              <button
                onClick={restoreZoom}
                className="graph-control-button"
                title="Restore View"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  color: '#2c3e50',
                  border: '2px solid #e1e8ed',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f8f9fa';
                  e.target.style.borderColor = '#3498db';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.95)';
                  e.target.style.borderColor = '#e1e8ed';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                🎯
              </button>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="info-panel">
          
          {selectedNode ? (
            <div>
              <h3 className="node-header">
                <span 
                  className="node-color-indicator"
                  style={{
                    backgroundColor: graphRef.current?.getNodeAttribute(selectedNode.id, 'originalColor') || '#3498db'
                  }}
                />
                <a 
                  href={`https://${selectedNode.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: 'inherit', 
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                >
                  {selectedNode.id}
                </a>
              </h3>

              {/* Enhanced Attributes Section */}
              {(() => {
                // Collect all possible attributes from different sources
                const allAttributes = {};
                
                // Add direct node properties (excluding standard graph properties)
                const excludeKeys = ['id', 'x', 'y', 'size', 'color', 'label', 'metadata'];
                Object.entries(selectedNode).forEach(([key, value]) => {
                  if (!excludeKeys.includes(key) && typeof value !== 'object') {
                    allAttributes[key] = value;
                  }
                });
                
                // Add attributes object properties
                if (selectedNode.attributes) {
                  Object.entries(selectedNode.attributes).forEach(([key, value]) => {
                    allAttributes[key] = value;
                  });
                }
                
                const hasAttributes = Object.keys(allAttributes).length > 0;
                
                return hasAttributes ? (
                  <div className="attributes-section">
                    <h4 className="attributes-title">Attributes</h4>
                    <div className="attributes-container">
                      {Object.entries(allAttributes).map(([key, value]) => (
                        <div key={key} className="attribute-item">
                          <strong className="attribute-key">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong>
                          <div className="attribute-value">
                            {Array.isArray(value) ? (
                              <ul className="array-value">
                                {value.map((item, idx) => (
                                  <li key={idx}>{String(item)}</li>
                                ))}
                              </ul>
                            ) : typeof value === 'boolean' ? (
                              <span className={`boolean-value ${value ? 'true' : 'false'}`}>
                                {value ? '✓ True' : '✗ False'}
                              </span>
                            ) : typeof value === 'number' ? (
                              <span className="number-value">{value.toLocaleString()}</span>
                            ) : (
                              String(value)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}


              {/* Similarity Table */}
              <div className="similarity-section">
                <h4 className="similarity-title">
                  Similar Nodes
                </h4>
                {similarNodes.length > 0 ? (
                  <div className="similarity-table-container">
                    <table className="similarity-table">
                      <thead>
                        <tr>
                          <th>Node</th>
                          <th className="center">Similarity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {similarNodes.map((item, index) => (
                          <tr 
                            key={item.nodeId}
                            onClick={() => handleSimilarNodeClick(item.nodeId)}
                          >
                            <td>
                              <span className="node-name">
                                {item.nodeId}
                              </span>
                            </td>
                            <td className="center">
                              <span className={`similarity-badge ${
                                item.similarity > 0.6 ? 'similarity-high' : 
                                item.similarity > 0.3 ? 'similarity-medium' : 'similarity-low'
                              }`}>
                                {item.similarity.toFixed(3)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="no-similar-nodes">
                    {availableSimilarityMetrics.length === 0 
                      ? "No similarity measures available in this graph"
                      : `No similar nodes found with ${
                          availableSimilarityMetrics.find(m => m.value === similarityMetric)?.label || 
                          similarityMetric.replace('_', ' ')
                        } data`
                    }
                  </div>
                )}
              </div>
            </div>
          ) : topicResults.length > 0 ? (
            <div className="topic-results">
              <h4>Top {topicResults.length} similar nodes:</h4>
              <ul>
                {topicResults.map((item, idx) => (
                  <li 
                    key={item.node_id}
                    onClick={() => handleTopicResultClick(item.node_id)}
                    className="topic-result-item"
                  >
                    <b>{item.node_id}</b> (similarity: {item.similarity.toFixed(3)})
                  </li>
                ))}
              </ul>
            </div>
          ) : !isGraphLoaded ? (
            // Show loading message if graph is not yet loaded
            <div className="welcome-panel">
              <div className="welcome-icon">⏳</div>
              <h4 className="welcome-title">Loading Graph...</h4>
              <p className="welcome-description">Preparing the visualization</p>
            </div>
          ) : (
            // Show the original info panel if a graph is loaded and no node is selected
            <div className="welcome-panel">
              <div className="welcome-icon">🕸️</div>
              <h4 className="welcome-title">Network Explorer</h4>
              <p className="welcome-description">Hover or click nodes to explore connections</p>
              <div className="navigation-guide">
                <h5 className="navigation-title">Navigation:</h5>
                <ul className="navigation-list">
                  <li className="navigation-item">🖱️ Click: Select nodes</li>
                  <li className="navigation-item">👆 Hover: Highlight connections</li>
                  <li className="navigation-item">🔍 Zoom: Mouse wheel</li>
                  <li className="navigation-item">🔄 Pan: Drag to move</li>
                </ul>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Description Panel - Bottom */}
      {selectedNode && (
        <div className="description-panel">
          <h4 className="description-panel-title">{selectedNode.id}</h4>
          <div className="description-content">
            <div className="description-flex-2col">
              {/* Left: 2x2 grid for details */}
              <div className="description-details-2x2">
                <div className="description-item">
                  {selectedNode.metadata?.title && (
                    <><strong>Title:</strong> {selectedNode.metadata.title}</>
                  )}
                </div>
                <div className="description-item">
                  {selectedNode.metadata?.server_source && (
                    <><strong>Server Source:</strong> <a href={selectedNode.metadata.server_source} target="_blank" rel="noopener noreferrer">{selectedNode.metadata.server_source}</a></>
                  )}
                </div>
                <div className="description-item">
                  {selectedNode.metadata?.active_users !== undefined && (
                    <><strong>Active Users:</strong> {selectedNode.metadata.active_users}</>
                  )}
                </div>
                <div className="description-item">
                  {selectedNode.metadata?.description && (
                    <><strong>Description:</strong><br/>{selectedNode.metadata.description}</>
                  )}
                </div>
              </div>
              {/* Right: Rules only */}
              <div className="description-item description-rules-col">
                {(() => {
                  let rules = selectedNode.metadata?.rules;
                  let parsed = null;
                  let isEmpty = false;
                  if (typeof rules === 'string') {
                    const trimmed = rules.trim();
                    if (!trimmed || trimmed === '[]') {
                      isEmpty = true;
                    } else if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                      try {
                        parsed = JSON.parse(rules);
                      } catch (e1) {
                        try {
                          parsed = JSON.parse(rules.replace(/'/g, '"'));
                        } catch (e2) {
                          // Regex fallback: extract quoted items (handles both ' and ")
                          const matches = Array.from(trimmed.matchAll(/(['"])(.*?)\1/g)).map(m => m[2]);
                          if (matches.length > 0) {
                            parsed = matches;
                          } else {
                            parsed = [rules];
                          }
                        }
                      }
                      if (Array.isArray(parsed) && parsed.length === 0) isEmpty = true;
                      rules = parsed;
                    } else {
                      rules = [rules];
                    }
                  }
                  if (Array.isArray(rules)) {
                    // Remove empty/whitespace-only rules
                    const filtered = rules.filter(r => (typeof r === 'string' ? r.trim() : r && r.text && r.text.trim())).map(r => typeof r === 'string' ? r : r.text || String(r));
                    if (filtered.length === 0) isEmpty = true;
                    if (isEmpty) {
                      return (
                        <>
                          <strong>Rules:</strong>
                          <div style={{ color: '#888', fontStyle: 'italic', background: '#fafbfc', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px', marginTop: 4 }}>
                            No rules
                          </div>
                        </>
                      );
                    }
                    return (
                      <>
                        <strong>Rules:</strong>
                        <div className="rules-list-box">
                          <ul style={{ margin: 0, paddingLeft: 18, listStyleType: 'disc' }}>
                            {filtered.map((rule, idx) => (
                              <li key={idx} style={{ marginBottom: 8, lineHeight: 1.5 }}>{rule}</li>
                            ))}
                          </ul>
                        </div>
                      </>
                    );
                  }
                  // If rules is null/undefined or empty string
                  if (!rules || isEmpty) {
                    return (
                      <>
                        <strong>Rules:</strong>
                        <div style={{ color: '#888', fontStyle: 'italic', background: '#fafbfc', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px', marginTop: 4 }}>
                          No rules
                        </div>
                      </>
                    );
                  }
                  // Fallback: show as single bullet
                  return (
                    <>
                      <strong>Rules:</strong>
                      <div className="rules-list-box">
                        <ul style={{ margin: 0, paddingLeft: 18, listStyleType: 'disc' }}>
                          <li>{String(rules)}</li>
                        </ul>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}