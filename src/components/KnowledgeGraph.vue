<!-- frontend-vue/src/components/KnowledgeGraph.vue -->
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
        <el-button size="small" @click="fitView" :icon="ZoomIn">适应画布</el-button>
        <el-button size="small" @click="resetZoom" :icon="RefreshRight">重置</el-button>
        <el-button size="small" @click="refreshData" :icon="Refresh" :loading="loading">刷新</el-button>
      </div>
    </div>
    <div ref="graphRef" class="graph-content"></div>
    <div v-if="loading" class="loading-overlay">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载图谱数据...</span>
    </div>
    <div v-if="nodeCount > 0" class="stats">
      <el-tag size="small">节点: {{ nodeCount }}</el-tag>
      <el-tag size="small" type="success">关系: {{ edgeCount }}</el-tag>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, ZoomIn, RefreshRight, Refresh } from '@element-plus/icons-vue'
import G6 from '@antv/g6'
import { kgApi } from '../api'

const graphRef = ref(null)
const loading = ref(false)
const layoutType = ref('force')
const nodeCount = ref(0)
const edgeCount = ref(0)
let graph = null

// 节点颜色映射
const nodeColors = {
  Project: '#1890ff',
  Material: '#52c41a',
  Supplier: '#eb2f96',
  Inventory: '#faad14',
  PurchaseOrder: '#722ed1'
}

// 节点图标映射
const nodeIcons = {
  Project: '📁',
  Material: '🔧',
  Supplier: '🏭',
  Inventory: '📦',
  PurchaseOrder: '📄'
}

// 布局配置
const layouts = {
  force: {
    type: 'force',
    preventOverlap: true,
    nodeSpacing: 80,
    linkDistance: 200,
    edgeStrength: 0.8,
    nodeStrength: -100,
    alpha: 0.3,
    alphaDecay: 0.028,
    alphaMin: 0.01,
    collideStrength: 0.8,
    force: 'center'
  },
  dagre: {
    type: 'dagre',
    rankdir: 'LR',
    align: 'UL',
    nodesep: 60,
    ranksep: 100
  },
  radial: {
    type: 'radial',
    unitRadius: 120,
    preventOverlap: true,
    nodeSize: 60,
    linkDistance: 100
  }
}

// 文本换行函数
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

const loadData = async () => {
  loading.value = true
  try {
    const res = await kgApi.getGraphData(100)
    const data = res.data

    nodeCount.value = data.nodes.length
    edgeCount.value = data.edges.length

    if (!data.nodes.length) {
      ElMessage.warning('暂无图谱数据，请先导入数据')
      return
    }

    // 转换数据格式 - 圆形节点
    const nodes = data.nodes.map(node => {
      // 获取显示名称
      let displayName = node.properties?.name || node.label || node.type || '未知'
      // 限制长度并换行
      const wrappedName = wrapText(displayName, 8)

      return {
        id: String(node.id),
        label: wrappedName,
        originalLabel: displayName,
        nodeType: node.label,
        size: 70,  // 圆形节点大小
        style: {
          fill: nodeColors[node.label] || '#999',
          stroke: '#fff',
          lineWidth: 2,
          shadowBlur: 5,
          shadowColor: 'rgba(0,0,0,0.3)',
          cursor: 'pointer'
        },
        labelCfg: {
          style: {
            fill: '#fff',
            fontSize: 11,
            fontWeight: '500',
            textAlign: 'center',
            textBaseline: 'middle',
            lineHeight: 16
          },
          position: 'center',
          offset: [0, 0]
        },
        // 自定义图标
        icon: {
          show: true,
          text: nodeIcons[node.label] || '●',
          style: {
            fill: '#fff',
            fontSize: 24,
            fontWeight: 'bold'
          }
        }
      }
    })

    const edges = data.edges.map(edge => ({
      id: edge.id,
      source: String(edge.source),
      target: String(edge.target),
      label: edge.label,
      style: {
        stroke: '#1890ff',
        lineWidth: 2,
        endArrow: {
          path: G6.Arrow.triangle(8, 6, 0),
          fill: '#1890ff'
        }
      },
      labelCfg: {
        autoRotate: true,
        style: {
          fill: '#666',
          fontSize: 10,
          background: {
            fill: '#fff',
            padding: [2, 4, 2, 4],
            radius: 2,
            stroke: '#e8edf3'
          }
        }
      }
    }))

    renderGraph(nodes, edges)
    ElMessage.success(`加载了 ${data.nodes.length} 个节点，${data.edges.length} 条关系`)
  } catch (error) {
    console.error('加载图谱数据失败:', error)
    ElMessage.error('加载图谱数据失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const renderGraph = (nodes, edges) => {
  if (graph) {
    graph.destroy()
  }

  const container = graphRef.value
  if (!container) return

  const width = container.clientWidth || 800
  const height = container.clientHeight || 500

  // 注册自定义节点类型...
  // (保持之前的节点注册代码不变)

  graph = new G6.Graph({
    container,
    width,
    height,
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select', 'hover-node']
    },
    layout: layouts[layoutType.value],
    defaultNode: {
      type: 'circle-with-text',
      size: 70,
      style: {
        fill: '#5B8FF9',
        stroke: '#fff',
        lineWidth: 2,
        shadowBlur: 5,
        shadowColor: 'rgba(0,0,0,0.3)'
      },
      labelCfg: {
        style: {
          fill: '#fff',
          fontSize: 11,
          fontWeight: '500',
          textAlign: 'center',
          textBaseline: 'middle',
          lineHeight: 16
        },
        position: 'center'
      }
    },
    defaultEdge: {
      type: 'line',
      style: {
        stroke: '#1890ff',
        lineWidth: 2,
        endArrow: {
          path: G6.Arrow.triangle(8, 6, 0),
          fill: '#1890ff'
        },
        lineAppendWidth: 8
      },
      labelCfg: {
        autoRotate: true,
        style: {
          fill: '#666',
          fontSize: 10,
          background: {
            fill: '#fff',
            padding: [2, 4, 2, 4],
            radius: 2,
            stroke: '#e8edf3'
          }
        }
      }
    },
    nodeStateStyles: {
      hover: {
        shadowBlur: 15,
        shadowColor: 'rgba(0,0,0,0.5)',
        lineWidth: 3,
        stroke: '#ff9900'
      },
      selected: {
        shadowBlur: 20,
        shadowColor: 'rgba(24,144,255,0.8)',
        lineWidth: 3,
        stroke: '#ff6600'
      }
    },
    edgeStateStyles: {
      hover: {
        stroke: '#ff9900',
        lineWidth: 3
      },
      selected: {
        stroke: '#ff6600',
        lineWidth: 3
      }
    },
    // 添加这些配置确保所有节点都显示
    animate: true,
    animateCfg: {
      duration: 500,
      easing: 'easeCubic'
    },
    fitView: true,
    fitViewPadding: [20, 20, 20, 20]
  })

  graph.data({ nodes, edges })
  graph.render()

  // 优化力导向布局的迭代次数
  if (layoutType.value === 'force') {
    // 增加迭代次数，让布局充分展开
    let iterations = 0
    const maxIterations = 50  // 增加到50次迭代

    const animateLayout = () => {
      if (iterations < maxIterations) {
        graph.layout()
        iterations++
        setTimeout(animateLayout, 50)
      } else {
        // 布局完成后适应画布
        setTimeout(() => {
          graph.fitView(30)
          // 打印实际显示的节点和边数量
          const nodeCount = graph.getNodes().length
          const edgeCount = graph.getEdges().length
          console.log(`布局完成: ${nodeCount} 个节点, ${edgeCount} 条边`)
        }, 100)
      }
    }

    animateLayout()
  } else {
    setTimeout(() => {
      graph.fitView(30)
    }, 300)
  }

  // 节点点击事件
  graph.on('node:click', (evt) => {
    const node = evt.item.getModel()
    const originalName = node.originalLabel || node.label
    ElMessage.info(`${node.nodeType}: ${originalName}`)
    console.log('点击节点:', node)
  })

  // 边点击事件
  graph.on('edge:click', (evt) => {
    const edge = evt.item.getModel()
    ElMessage.info(`关系: ${edge.label}`)
    console.log('点击关系:', edge)
  })

  // 调试：打印节点和边数量
  console.log(`渲染完成: ${nodes.length} 个节点, ${edges.length} 条边`)
}

const changeLayout = () => {
  if (!graph) return
  graph.updateLayout(layouts[layoutType.value])
  setTimeout(() => {
    graph.fitView(30)
  }, 100)
}

const fitView = () => {
  if (graph) {
    graph.fitView(30)
  }
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

// 监听窗口大小变化
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
  if (graph) {
    graph.destroy()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.graph-container {
  position: relative;
  height: 100%;
  background: linear-gradient(135deg, #f8faff 0%, #f0f2f5 100%);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.graph-header {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 12px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
}

.header-left h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2f3d;
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

.graph-content {
  width: 100%;
  height: 100%;
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
  display: flex;
  gap: 12px;
  align-items: center;
  z-index: 20;
  font-size: 14px;
  backdrop-filter: blur(4px);
}

.stats {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
</style>