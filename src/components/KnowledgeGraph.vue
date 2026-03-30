<template>
  <div class="graph-container">
    <div class="graph-header">
      <h3>🔗 知识图谱</h3>
      <p>供应链节点关系可视化</p>
    </div>
    <div ref="graphRef" class="graph-content"></div>
    <div v-if="loading" class="loading">加载中...</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Graph } from '@antv/g6'  // 修改这里！
import { kgApi } from '../api'

const graphRef = ref(null)
const loading = ref(false)
let graph = null

onMounted(async () => {
  loading.value = true
  try {
    const res = await kgApi.getGraphData(30)
    console.log('图谱数据:', res.data)

    if (res.data.nodes && res.data.nodes.length > 0) {
      // 渲染图谱
      renderGraph(res.data.nodes, res.data.edges)
      ElMessage.success(`加载了 ${res.data.nodes.length} 个节点`)
    } else {
      ElMessage.warning('暂无图谱数据，请先导入数据')
    }
  } catch (error) {
    console.error('加载失败:', error)
    ElMessage.error('加载图谱数据失败')
  } finally {
    loading.value = false
  }
})

const renderGraph = (nodes, edges) => {
  if (!graphRef.value) return

  // 转换数据格式
  const g6Nodes = nodes.map(node => ({
    id: String(node.id),
    label: node.properties?.name || node.label,
    style: {
      fill: getNodeColor(node.label),
      stroke: '#333',
      lineWidth: 1
    }
  }))

  const g6Edges = edges.map(edge => ({
    id: edge.id,
    source: String(edge.source),
    target: String(edge.target),
    label: edge.label
  }))

  // 创建图谱实例
  graph = new Graph({
    container: graphRef.value,
    width: graphRef.value.clientWidth,
    height: 500,
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node']
    },
    layout: {
      type: 'dagre',
      rankdir: 'LR',
      nodesep: 50,
      ranksep: 80
    },
    defaultNode: {
      type: 'rect',
      size: [120, 40],
      style: {
        radius: 8,
        fill: '#5B8FF9',
        stroke: '#333',
        lineWidth: 1
      },
      labelCfg: {
        style: {
          fill: '#fff',
          fontSize: 12
        },
        position: 'center'
      }
    },
    defaultEdge: {
      type: 'polyline',
      style: {
        stroke: '#1890ff',
        lineWidth: 2,
        endArrow: true
      },
      labelCfg: {
        autoRotate: true,
        style: {
          fill: '#666',
          fontSize: 10
        }
      }
    }
  })

  graph.data({ nodes: g6Nodes, edges: g6Edges })
  graph.render()
  graph.fitView(20)
}

const getNodeColor = (label) => {
  const colors = {
    Project: '#1890ff',
    Material: '#52c41a',
    Supplier: '#eb2f96',
    Inventory: '#faad14',
    PurchaseOrder: '#722ed1'
  }
  return colors[label] || '#999'
}
</script>

<style scoped>
.graph-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  height: 100%;
}
.graph-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
  margin-bottom: 20px;
}
.graph-content {
  height: calc(100% - 80px);
  background: #fafafa;
  border-radius: 8px;
  overflow: hidden;
}
.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>