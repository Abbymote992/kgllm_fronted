<template>
  <div class="graph-container">
    <div class="graph-header">
      <div class="header-left">
        <h3>🔗 知识图谱</h3>
        <p>供应链节点关系可视化</p>
      </div>
      <div class="header-right">
        <el-radio-group v-model="layoutType" size="small" @change="changeLayout">
          <el-radio-button value="force">力导向布局</el-radio-button>
          <el-radio-button value="dagre">层次布局</el-radio-button>
          <el-radio-button value="radial">径向布局</el-radio-button>
        </el-radio-group>
        <el-button size="small" @click="fitView">适应画布</el-button>
        <el-button size="small" @click="resetZoom">重置</el-button>
        <el-button size="small" @click="refreshData" :loading="loading">刷新</el-button>
      </div>
    </div>

    <div class="main-content">
      <div ref="graphRef" class="graph-content"></div>

      <div class="side-panel">
        <div v-if="!selectedElement" class="panel-section">
          <h4>📊 Overview</h4>
          <div class="overview-content">
            <div class="stat-row">
              <span class="stat-label">节点总数:</span>
              <span class="stat-value">{{ nodeCount }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">关系总数:</span>
              <span class="stat-value">{{ edgeCount }}</span>
            </div>
            <div class="node-labels">
              <div class="labels-header">Node labels</div>
              <div v-for="(count, label) in nodeLabelCounts" :key="label" class="label-item">
                <span class="label-color" :style="{ background: nodeColors[label] }"></span>
                <span class="label-name">{{ label }}</span>
                <span class="label-count">({{ count }})</span>
              </div>
            </div>
            <div class="relation-types">
              <div class="labels-header">Relationship types</div>
              <div v-for="(count, relType) in relationTypeCounts" :key="relType" class="relation-item">
                <span class="relation-name">{{ relType }}</span>
                <span class="relation-count">({{ count }})</span>
              </div>
            </div>
            <div class="hint-text">💡 鼠标悬浮查看详情，点击固定</div>
          </div>
        </div>

        <div v-else class="panel-section">
          <div class="detail-header">
            <h4>{{ selectedElement.type === 'node' ? '📍 Node properties' : '🔗 Relationship properties' }}</h4>
            <el-button size="small" @click="clearSelection">关闭</el-button>
          </div>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">ID:</span>
              <span class="detail-value">{{ selectedElement.id }}</span>
            </div>
            <div v-if="selectedElement.type === 'node'" class="detail-row">
              <span class="detail-label">Label:</span>
              <span class="detail-value">{{ selectedElement.label }}</span>
            </div>
            <div v-if="selectedElement.type === 'edge'" class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="detail-value">{{ selectedElement.relationType }}</span>
            </div>
            <div v-if="selectedElement.type === 'edge'" class="detail-row">
              <span class="detail-label">Source:</span>
              <span class="detail-value">{{ selectedElement.sourceName }}</span>
            </div>
            <div v-if="selectedElement.type === 'edge'" class="detail-row">
              <span class="detail-label">Target:</span>
              <span class="detail-value">{{ selectedElement.targetName }}</span>
            </div>
            <div v-if="selectedElement.properties" class="properties-section">
              <div class="properties-header">Properties</div>
              <div v-for="(value, key) in selectedElement.properties" :key="key" class="property-row">
                <span class="property-key">{{ key }}</span>
                <span class="property-value">{{ formatPropertyValue(value) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-overlay">
      <span>加载图谱数据...</span>
    </div>

    <div v-if="nodeCount > 0" class="stats">
      <span>节点: {{ nodeCount }}</span>
      <span>关系: {{ edgeCount }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import G6 from '@antv/g6'
import { kgApi } from '../api'

const graphRef = ref(null)
const loading = ref(false)
const layoutType = ref('force')
const nodeCount = ref(0)
const edgeCount = ref(0)
const nodeLabelCounts = reactive({})
const relationTypeCounts = reactive({})
const selectedElement = ref(null)

let graph = null

const nodeColors = {
  Project: '#7B9ADF',
  Material: '#7CB97C',
  Supplier: '#D68AB5',
  Inventory: '#E5C07B',
  PurchaseOrder: '#9D7CC9',
  WorkOrder: '#56B4E9',
  RiskEvent: '#E79A9A',
  Module: '#A3A3A3',
  Warehouse: '#C4A35A'
}

const layouts = {
  force: { type: 'force', preventOverlap: true, nodeSpacing: 80, linkDistance: 200 },
  dagre: { type: 'dagre', rankdir: 'LR', align: 'UL', nodesep: 60, ranksep: 100 },
  radial: { type: 'radial', unitRadius: 120, preventOverlap: true }
}

const wrapText = (text, maxWidth = 8) => {
  if (!text) return ''
  const str = String(text)
  if (str.length <= maxWidth) return str
  const lines = []
  let line = ''
  for (let i = 0; i < str.length; i++) {
    line += str[i]
    if (line.length >= maxWidth && i < str.length - 1) {
      lines.push(line)
      line = ''
    }
  }
  if (line) lines.push(line)
  return lines.join('\n')
}

const formatPropertyValue = (value) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const clearSelection = () => {
  selectedElement.value = null
}

const getNodeName = (nodeId, nodes) => {
  const node = nodes.find(n => String(n.id) === String(nodeId))
  return node ? node.originalLabel || node.label : nodeId
}

const loadData = async () => {
  loading.value = true
  selectedElement.value = null
  try {
    const res = await kgApi.getGraphData(200)
    const data = res.data

    nodeCount.value = data.nodes.length
    edgeCount.value = data.edges.length

    Object.keys(nodeLabelCounts).forEach(key => delete nodeLabelCounts[key])
    data.nodes.forEach(node => {
      const label = node.label || node.type || 'Unknown'
      nodeLabelCounts[label] = (nodeLabelCounts[label] || 0) + 1
    })

    Object.keys(relationTypeCounts).forEach(key => delete relationTypeCounts[key])
    data.edges.forEach(edge => {
      const relType = edge.label || 'UNKNOWN'
      relationTypeCounts[relType] = (relationTypeCounts[relType] || 0) + 1
    })

    const nodeIdSet = new Set()
    const nodes = data.nodes.map((node, index) => {
      let displayName = node.properties?.name || node.label || node.type || '未知'
      const wrappedName = wrapText(displayName, 8)
      const nodeType = node.label || node.type || 'Unknown'
      
      // 确保节点ID唯一
      let nodeId = String(node.id)
      if (nodeIdSet.has(nodeId)) {
        nodeId = `${nodeId}_${index}`
      }
      nodeIdSet.add(nodeId)
      
      return {
        id: nodeId,
        label: wrappedName,
        originalLabel: displayName,
        nodeType: nodeType,
        size: 70,
        properties: node.properties || {},
        style: {
          fill: nodeColors[nodeType] || '#999',
          stroke: '#fff',
          lineWidth: 2
        },
        labelCfg: {
          style: { fill: '#fff', fontSize: 11, textAlign: 'center' },
          position: 'center'
        }
      }
    })

    const edgeIdSet = new Set()
    const validEdges = []
    
    // 创建节点ID快速查找表
    const nodeIdMap = new Map()
    nodes.forEach(node => {
      nodeIdMap.set(node.id, node)
      // 如果节点有原始ID，也添加映射
      if (node.original_id) {
        nodeIdMap.set(String(node.original_id), node)
      }
    })
    
    console.log('节点ID映射:', Array.from(nodeIdMap.keys()))
    
    data.edges.forEach((edge, index) => {
      // 确保边ID唯一
      let edgeId = edge.id || `edge_${index}`
      if (edgeIdSet.has(edgeId)) {
        edgeId = `${edgeId}_${index}`
      }
      edgeIdSet.add(edgeId)
      
      // 获取源节点和目标节点
      let sourceId = String(edge.source)
      let targetId = String(edge.target)
      
      // 查找有效的节点ID
      const sourceNode = nodeIdMap.get(sourceId) || nodeIdMap.get(sourceId.replace(/_\d+$/, ''))
      const targetNode = nodeIdMap.get(targetId) || nodeIdMap.get(targetId.replace(/_\d+$/, ''))
      
      if (sourceNode && targetNode) {
        validEdges.push({
          id: edgeId,
          source: sourceNode.id,
          target: targetNode.id,
          label: edge.label || 'UNKNOWN',
          properties: edge.properties || {},
          style: { stroke: '#8BAFD4', lineWidth: 2, endArrow: { path: G6.Arrow.triangle(8, 6, 0), fill: '#8BAFD4' } }
        })
      } else {
        console.warn(`跳过无效边 ${edgeId}: source=${sourceId}(${!!sourceNode}), target=${targetId}(${!!targetNode})`)
      }
    })
    
    console.log(`原始边数: ${data.edges.length}, 有效边数: ${validEdges.length}`)

    renderGraph(nodes, validEdges)
  } catch (error) {
    console.error('加载图谱数据失败:', error)
  } finally {
    loading.value = false
  }
}

const renderGraph = (nodes, edges) => {
  if (graph) graph.destroy()

  const container = graphRef.value
  if (!container) return

  const width = container.clientWidth || 800
  const height = container.clientHeight || 500

  graph = new G6.Graph({
    container,
    width,
    height,
    modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node'] },
    layout: layouts[layoutType.value],
    defaultNode: { type: 'circle', size: 70, style: { fill: '#7B9ADF', stroke: '#fff', lineWidth: 2 } },
    defaultEdge: { type: 'line', style: { stroke: '#8BAFD4', lineWidth: 2 } },
    fitView: true
  })

  graph.data({ nodes, edges })
  graph.render()

  graph.on('node:mouseenter', (evt) => {
    const node = evt.item.getModel()
    if (!selectedElement.value) {
      selectedElement.value = { type: 'node', id: node.id, label: node.nodeType, properties: node.properties }
    }
  })

  graph.on('node:mouseleave', () => {
    if (!selectedElement.value?.fixed) selectedElement.value = null
  })

  graph.on('node:click', (evt) => {
    const node = evt.item.getModel()
    selectedElement.value = { type: 'node', id: node.id, label: node.nodeType, properties: node.properties, fixed: true }
  })

  graph.on('edge:mouseenter', (evt) => {
    const edge = evt.item.getModel()
    if (!selectedElement.value) {
      selectedElement.value = {
        type: 'edge',
        id: edge.id,
        relationType: edge.label,
        sourceName: getNodeName(edge.source, nodes),
        targetName: getNodeName(edge.target, nodes),
        properties: edge.properties
      }
    }
  })

  graph.on('edge:mouseleave', () => {
    if (!selectedElement.value?.fixed) selectedElement.value = null
  })

  graph.on('edge:click', (evt) => {
    const edge = evt.item.getModel()
    selectedElement.value = {
      type: 'edge',
      id: edge.id,
      relationType: edge.label,
      sourceName: getNodeName(edge.source, nodes),
      targetName: getNodeName(edge.target, nodes),
      properties: edge.properties,
      fixed: true
    }
  })

  graph.on('canvas:click', () => {
    clearSelection()
  })

  setTimeout(() => graph.fitView(30), 500)
}

const changeLayout = () => {
  if (!graph) return
  selectedElement.value = null
  graph.updateLayout(layouts[layoutType.value])
  setTimeout(() => graph.fitView(30), 100)
}

const fitView = () => {
  if (graph) graph.fitView(30)
}

const resetZoom = () => {
  if (graph) {
    graph.zoomTo(1)
    graph.fitCenter()
  }
}

const refreshData = () => {
  loadData()
}

const handleResize = () => {
  if (graph && graphRef.value) {
    const width = graphRef.value.clientWidth
    const height = graphRef.value.clientHeight
    graph.changeSize(width, height)
    graph.fitView(30)
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (graph) graph.destroy()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.graph-container {
  position: relative;
  height: 100%;
  background: #f8faff;
  border-radius: 16px;
  overflow: hidden;
}

.graph-header {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 320px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 12px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.header-left h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.header-left p {
  margin: 0;
  font-size: 12px;
  color: #8c9aa8;
}

.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.main-content {
  display: flex;
  height: 100%;
}

.graph-content {
  flex: 1;
  height: 100%;
  padding-top: 70px;
}

.side-panel {
  width: 300px;
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-left: 1px solid #e8edf3;
  padding: 16px;
  overflow-y: auto;
}

.panel-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.panel-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed #e8edf3;
}

.stat-label {
  color: #8c9aa8;
}

.stat-value {
  font-weight: 600;
}

.label-item, .relation-item {
  display: flex;
  align-items: center;
  padding: 4px 0;
  gap: 8px;
}

.label-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.label-name, .relation-name {
  flex: 1;
}

.label-count, .relation-count {
  color: #8c9aa8;
  font-size: 12px;
}

.hint-text {
  margin-top: 16px;
  padding: 10px;
  background: #f7fafc;
  border-radius: 8px;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed #e8edf3;
}

.detail-label {
  color: #8c9aa8;
  font-weight: 500;
}

.detail-value {
  color: #1f2f3d;
  font-weight: 500;
}

.properties-section {
  margin-top: 12px;
}

.properties-header {
  font-size: 12px;
  color: #8c9aa8;
  margin-bottom: 8px;
}

.property-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.property-key {
  color: #64748b;
}

.property-value {
  color: #1f2f3d;
  text-align: right;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 12px 24px;
  border-radius: 32px;
}

.stats {
  position: absolute;
  bottom: 16px;
  right: 336px;
  z-index: 10;
  display: flex;
  gap: 16px;
  background: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
}
</style>