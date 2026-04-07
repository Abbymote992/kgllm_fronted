<!-- frontend-vue/src/components/ChatInterface.vue -->
<template>
  <div class="chat-container">
    <div class="chat-header">
      <h3>💬 智能问答</h3>
      <div class="mode-selector">
        <el-radio-group v-model="requestMode" size="small">
          <el-radio-button label="stream">流式模式</el-radio-button>
          <el-radio-button label="async">异步模式</el-radio-button>
          <el-radio-button label="sync">同步模式</el-radio-button>
        </el-radio-group>
      </div>
      <p class="subtitle">基于知识图谱的供应链问答（流式模式体验最佳）</p>
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div v-if="messages.length === 0" class="empty">
        <el-icon :size="48"><ChatDotRound /></el-icon>
        <p>试试问我：</p>
        <div class="example-questions">
          <el-tag
              v-for="q in exampleQuestions"
              :key="q"
              class="example-tag"
              @click="inputValue = q"
          >
            {{ q }}
          </el-tag>
        </div>
      </div>

      <div v-for="msg in messages" :key="msg.id" :class="['message', msg.role]">
        <div class="avatar">
          <el-avatar :size="36" :style="{ background: msg.role === 'user' ? '#1890ff' : '#52c41a' }">
            {{ msg.role === 'user' ? '我' : 'AI' }}
          </el-avatar>
        </div>
        <div class="content">
          <div class="text">{{ msg.content }}</div>

          <!-- 显示子图（知识图谱片段） -->
          <div v-if="msg.subgraph && msg.subgraph.nodes && msg.subgraph.nodes.length > 0" class="subgraph">
            <div class="subgraph-header" @click="toggleSubgraph(msg.id)">
              <span>🔗 相关知识图谱</span>
              <el-icon :class="{ rotated: expandedSubgraph === msg.id }">
                <ArrowDown />
              </el-icon>
            </div>
            <div
                v-show="expandedSubgraph === msg.id"
                :ref="(el) => setSubgraphRef(msg.id, el)"
                class="subgraph-container"
            ></div>
          </div>

          <!-- 显示流式输出时的光标 -->
          <span v-if="msg.isStreaming" class="streaming-cursor">▊</span>

          <!-- 显示生成的Cypher -->
          <div v-if="msg.cypher" class="cypher">
            <div class="cypher-header">
              <span>📝 生成的查询</span>
              <el-button size="small" text @click="copyCypher(msg.cypher)">复制</el-button>
            </div>
            <pre>{{ msg.cypher }}</pre>
          </div>

          <!-- 显示执行步骤（异步模式） -->
          <div v-if="msg.steps && msg.steps.length > 0" class="steps">
            <el-steps :active="msg.steps.length" finish-status="success" align-center>
              <el-step v-for="(step, idx) in msg.steps" :key="idx" :title="step.name" size="small" />
            </el-steps>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="message assistant">
        <div class="avatar">
          <el-avatar :size="36" style="background:#52c41a">AI</el-avatar>
        </div>
        <div class="content">
          <div class="typing">
            <span></span><span></span><span></span>
          </div>
          <div class="loading-text">{{ loadingText }}</div>
        </div>
      </div>

      <div ref="bottomRef"></div>
    </div>

    <div class="chat-input">
      <el-input
          v-model="inputValue"
          type="textarea"
          :rows="3"
          placeholder="输入问题，如：通信卫星平台项目需要什么物料？"
          @keydown.enter.prevent="sendMessage"
          :disabled="loading"
      />
      <div class="actions">
        <el-button type="primary" @click="sendMessage" :loading="loading">
          {{ loading ? '处理中' : '发送' }}
        </el-button>
        <el-button @click="clearMessages">清空</el-button>
        <el-button @click="newConversation">新对话</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, ArrowDown } from '@element-plus/icons-vue'
import { kgApi } from '../api'
import historyService from '../services/historyService'
import G6 from '@antv/g6'

const props = defineProps({
  initialConversation: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['conversation-saved'])

// 示例问题
const exampleQuestions = [
  '通信卫星平台项目需要什么物料？',
  '通信卫星平台项目涉及哪些供应商？',
  'MAT-001物料由哪个供应商提供？',
  '当前有哪些物料库存不足？',
  '查询所有延迟的采购订单'
]

// 状态
const messages = ref([])
const inputValue = ref('')
const loading = ref(false)
const loadingText = ref('准备就绪...')
const requestMode = ref('stream')
const messagesRef = ref(null)
const bottomRef = ref(null)
const currentConversationId = ref(null)
const subgraphRefs = ref({})
const expandedSubgraph = ref(null)
const subgraphInstances = ref({})

// 节点颜色映射
const nodeColors = {
  Project: '#1890ff',
  Material: '#52c41a',
  Supplier: '#eb2f96',
  Inventory: '#faad14',
  PurchaseOrder: '#722ed1'
}

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
}

// 保存当前对话
const saveCurrentConversation = () => {
  if (messages.value.length === 0) return

  const firstUserMsg = messages.value.find(m => m.role === 'user')
  const lastAssistantMsg = messages.value.filter(m => m.role === 'assistant').pop()

  const title = firstUserMsg?.content?.slice(0, 30) || '新对话'
  const preview = lastAssistantMsg?.content?.slice(0, 50) || ''

  const conversation = {
    id: currentConversationId.value || Date.now(),
    title,
    preview,
    messages: JSON.parse(JSON.stringify(messages.value)), // 深拷贝
    timestamp: new Date().toISOString()
  }

  historyService.saveConversation(conversation)
  if (!currentConversationId.value) {
    currentConversationId.value = conversation.id
  }
  emit('conversation-saved')
}

// 加载历史对话
const loadConversation = (conversation) => {
  if (conversation && conversation.messages) {
    messages.value = conversation.messages
    currentConversationId.value = conversation.id
    scrollToBottom()
  }
}

// 新对话
const newConversation = () => {
  messages.value = []
  currentConversationId.value = null
  inputValue.value = ''
  scrollToBottom()
}

// 清空当前对话
const clearMessages = () => {
  messages.value = []
  currentConversationId.value = null
}

// 复制Cypher
const copyCypher = (cypher) => {
  navigator.clipboard.writeText(cypher)
  ElMessage.success('已复制到剪贴板')
}

// 获取子图数据
const fetchSubgraph = async (cypher) => {
  if (!cypher) return null

  try {
    // 构建子图查询
    const subgraphCypher = `
      MATCH path = (n)-[r]->(m)
      WHERE EXISTS {
        MATCH (q)-[rel]-(w)
        WHERE n.id = q.id OR m.id = w.id
        AND (q:Project OR q:Material OR q:Supplier)
      }
      RETURN n, r, m
      LIMIT 30
    `

    const res = await kgApi.executeQuery({ cypher: subgraphCypher })

    if (res.data && res.data.length > 0) {
      return convertToGraphData(res.data)
    }
  } catch (error) {
    console.error('获取子图失败:', error)
  }
  return null
}

// 转换为G6图数据
const convertToGraphData = (data) => {
  const nodesMap = new Map()
  const edges = []

  data.forEach(record => {
    // 处理源节点
    if (record.n && !nodesMap.has(record.n.id)) {
      const labels = record.n.labels || []
      nodesMap.set(record.n.id, {
        id: record.n.id,
        label: record.n.properties?.name || labels[0] || 'Unknown',
        nodeType: labels[0] || 'Unknown'
      })
    }
    // 处理目标节点
    if (record.m && !nodesMap.has(record.m.id)) {
      const labels = record.m.labels || []
      nodesMap.set(record.m.id, {
        id: record.m.id,
        label: record.m.properties?.name || labels[0] || 'Unknown',
        nodeType: labels[0] || 'Unknown'
      })
    }
    // 处理边
    if (record.r) {
      edges.push({
        source: String(record.r.start),
        target: String(record.r.end),
        label: record.r.type
      })
    }
  })

  return {
    nodes: Array.from(nodesMap.values()),
    edges
  }
}

// 渲染子图
const renderSubgraph = (msgId, graphData) => {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return

  const container = subgraphRefs.value[msgId]
  if (!container) return

  const width = container.clientWidth || 400
  const height = 280

  // 清理旧的实例
  if (subgraphInstances.value[msgId]) {
    subgraphInstances.value[msgId].forEach(g => g?.destroy())
  }
  subgraphInstances.value[msgId] = []

  const graph = new G6.Graph({
    container,
    width,
    height,
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node']
    },
    layout: {
      type: 'dagre',
      rankdir: 'LR',
      nodesep: 40,
      ranksep: 60
    },
    defaultNode: {
      type: 'rect',
      size: [100, 36],
      style: {
        radius: 6,
        fill: (node) => nodeColors[node.nodeType] || '#999',
        stroke: '#333',
        lineWidth: 1,
        cursor: 'pointer'
      },
      labelCfg: {
        style: { fill: '#fff', fontSize: 11 },
        position: 'center'
      }
    },
    defaultEdge: {
      style: {
        stroke: '#1890ff',
        lineWidth: 2,
        endArrow: true,
        cursor: 'pointer'
      },
      labelCfg: {
        autoRotate: true,
        style: { fill: '#666', fontSize: 10 }
      }
    }
  })

  const nodes = graphData.nodes.map(node => ({
    id: String(node.id),
    label: node.label,
    nodeType: node.nodeType
  }))

  const edges = graphData.edges.map(edge => ({
    id: `${edge.source}_${edge.target}`,
    source: String(edge.source),
    target: String(edge.target),
    label: edge.label
  }))

  graph.data({ nodes, edges })
  graph.render()
  graph.fitView(20)

  subgraphInstances.value[msgId].push(graph)
}

// 设置子图容器引用
const setSubgraphRef = (msgId, el) => {
  if (el) {
    subgraphRefs.value[msgId] = el
  }
}

// 切换子图显示
const toggleSubgraph = (msgId) => {
  if (expandedSubgraph.value === msgId) {
    expandedSubgraph.value = null
  } else {
    expandedSubgraph.value = msgId
    // 延迟渲染，等待DOM更新
    setTimeout(() => {
      const msg = messages.value.find(m => m.id === msgId)
      if (msg && msg.subgraph) {
        renderSubgraph(msgId, msg.subgraph)
      }
    }, 100)
  }
}

// ==========================================
// 发送消息（根据模式选择）
// ==========================================

const sendMessage = async () => {
  const question = inputValue.value.trim()
  if (!question) return

  // 添加用户消息
  const userMsg = {
    id: Date.now(),
    role: 'user',
    content: question
  }
  messages.value.push(userMsg)
  inputValue.value = ''
  await scrollToBottom()

  // 根据模式选择处理方式
  if (requestMode.value === 'stream') {
    await sendStreamMessage(question)
  } else if (requestMode.value === 'async') {
    await sendAsyncMessage(question)
  } else {
    await sendSyncMessage(question)
  }

  // 保存对话
  saveCurrentConversation()
}

// 流式模式
const sendStreamMessage = async (question) => {
  loading.value = true
  loadingText.value = '正在理解问题...'

  // 创建临时消息
  const msgId = Date.now() + 1
  const streamingMsg = {
    id: msgId,
    role: 'assistant',
    content: '',
    isStreaming: true,
    cypher: null,
    subgraph: null
  }
  messages.value.push(streamingMsg)
  await scrollToBottom()

  let finalCypher = null

  try {
    await kgApi.askQuestionStream(
        question,
        // onChunk
        (chunk) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.content += chunk
            scrollToBottom()
          }
        },
        // onComplete
        async (fullAnswer, cypher) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.isStreaming = false
            msg.cypher = cypher
            finalCypher = cypher
          }
          loading.value = false
          ElMessage.success('回答完成')

          // 获取子图数据
          if (finalCypher) {
            const subgraphData = await fetchSubgraph(finalCypher)
            const msg = messages.value.find(m => m.id === msgId)
            if (msg && subgraphData && subgraphData.nodes.length > 0) {
              msg.subgraph = subgraphData
            }
          }
        },
        // onError
        (error) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.content = `生成回答失败: ${error}`
            msg.isStreaming = false
          }
          loading.value = false
          ElMessage.error('问答失败: ' + error)
        }
    )
  } catch (error) {
    const msg = messages.value.find(m => m.id === msgId)
    if (msg) {
      msg.content = `请求失败: ${error.message}`
      msg.isStreaming = false
    }
    loading.value = false
    ElMessage.error('请求失败')
  }
}

// 异步模式
const sendAsyncMessage = async (question) => {
  loading.value = true
  loadingText.value = '创建任务...'

  const msgId = Date.now() + 1
  const tempMsg = {
    id: msgId,
    role: 'assistant',
    content: '',
    steps: []
  }
  messages.value.push(tempMsg)
  await scrollToBottom()

  try {
    await kgApi.askQuestionAsync(
        question,
        // onProgress
        (stepName, steps) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.steps = steps || []
            loadingText.value = stepName
          }
        },
        // onComplete
        async (answer, cypher) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.content = answer
            msg.cypher = cypher

            // 获取子图数据
            if (cypher) {
              const subgraphData = await fetchSubgraph(cypher)
              if (subgraphData && subgraphData.nodes.length > 0) {
                msg.subgraph = subgraphData
              }
            }
          }
          loading.value = false
          ElMessage.success('回答完成')
        },
        // onError
        (error) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.content = `处理失败: ${error}`
          }
          loading.value = false
          ElMessage.error('问答失败: ' + error)
        }
    )
  } catch (error) {
    const msg = messages.value.find(m => m.id === msgId)
    if (msg) {
      msg.content = `请求失败: ${error.message}`
    }
    loading.value = false
    ElMessage.error('请求失败')
  }
}

// 同步模式
const sendSyncMessage = async (question) => {
  loading.value = true
  loadingText.value = '处理中...'

  try {
    const res = await kgApi.askQuestion(question)
    const msgId = Date.now() + 1

    const assistantMsg = {
      id: msgId,
      role: 'assistant',
      content: res.data.answer,
      cypher: res.data.cypher,
      subgraph: null
    }
    messages.value.push(assistantMsg)
    await scrollToBottom()

    // 获取子图数据
    if (res.data.cypher) {
      const subgraphData = await fetchSubgraph(res.data.cypher)
      const msg = messages.value.find(m => m.id === msgId)
      if (msg && subgraphData && subgraphData.nodes.length > 0) {
        msg.subgraph = subgraphData
      }
    }
  } catch (error) {
    console.error('问答失败:', error)
    ElMessage.error('问答失败，请稍后重试')
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: '抱歉，处理您的问题时出错了。请稍后再试。'
    })
  } finally {
    loading.value = false
  }
}

// 监听初始对话
watch(() => props.initialConversation, (conv) => {
  if (conv) {
    loadConversation(conv)
  }
}, { immediate: true, deep: true })

// 清理子图实例
onUnmounted(() => {
  Object.values(subgraphInstances.value).forEach(instances => {
    instances.forEach(g => g?.destroy())
  })
})

// 暴露方法给父组件
defineExpose({
  loadConversation,
  saveCurrentConversation,
  newConversation,
  clearMessages
})
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.chat-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.chat-header h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2f3d;
}

.mode-selector {
  margin: 12px 0 8px;
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: #8c9aa8;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #8c9aa8;
}

.empty .el-icon {
  color: #d0d7de;
  margin-bottom: 16px;
}

.example-questions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

.example-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.example-tag:hover {
  transform: translateY(-2px);
  background: #1890ff;
  color: white;
}

.message {
  display: flex;
  margin-bottom: 20px;
}

.message.user {
  flex-direction: row-reverse;
}

.message.user .avatar {
  margin-left: 12px;
}

.message.assistant .avatar {
  margin-right: 12px;
}

.content {
  max-width: 80%;
}

.message.user .content {
  background: #1890ff;
  color: white;
  padding: 12px 16px;
  border-radius: 18px 4px 18px 18px;
}

.message.assistant .content {
  background: #f5f7fa;
  color: #2c3e50;
  padding: 12px 16px;
  border-radius: 4px 18px 18px 18px;
}

.text {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.streaming-cursor {
  display: inline-block;
  animation: blink 1s infinite;
  margin-left: 2px;
  font-weight: bold;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.subgraph {
  margin-top: 16px;
  border-top: 1px solid #e8edf3;
  padding-top: 12px;
}

.subgraph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  color: #5a6874;
  padding: 4px 0;
}

.subgraph-header:hover {
  color: #1890ff;
}

.subgraph-header .el-icon {
  transition: transform 0.2s;
}

.subgraph-header .rotated {
  transform: rotate(180deg);
}

.subgraph-container {
  width: 100%;
  height: 280px;
  background: #fafbfc;
  border-radius: 8px;
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid #e8edf3;
}

.cypher {
  margin-top: 12px;
  background: #1e2a36;
  border-radius: 8px;
  overflow: hidden;
}

.cypher-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2d3e4f;
  color: #b0d4ff;
  font-size: 12px;
}

.cypher pre {
  margin: 0;
  padding: 12px;
  background: #1e2a36;
  color: #b0d4ff;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.steps {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #e8edf3;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing span {
  width: 8px;
  height: 8px;
  background: #8c9aa8;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.loading-text {
  font-size: 12px;
  color: #8c9aa8;
  margin-top: 8px;
}

.chat-input {
  padding: 20px 24px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}
</style>