<!-- frontend-vue/src/components/ChatInterface.vue -->
<template>
  <div class="chat-container">
    <div class="chat-header">
      <h3>💬 智能问答</h3>
      <div class="mode-selector">
        <el-radio-group v-model="requestMode" size="small">
<!--          <el-radio-button label="sync">同步模式</el-radio-button>-->
          <el-radio-button label="stream">流式模式</el-radio-button>
<!--          <el-radio-button label="async">异步模式</el-radio-button>-->
          <el-radio-button label="multi-agent">🤖 多智能体</el-radio-button>
        </el-radio-group>
      </div>
      <p class="subtitle">基于知识图谱的供应链问答（多智能体模式可查看协作过程）</p>
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
          <div v-if="msg.mode" class="mode-badge">
            <el-tag :type="msg.mode === 'multi-agent' ? 'primary' : 'success'" size="small">
              {{ msg.mode === 'multi-agent' ? '🤖 多智能体' : '💬 流式' }}
            </el-tag>
          </div>
          <div class="text">{{ msg.content }}</div>

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

          <div v-if="msg.isStreaming" class="typing-indicator">
            <span></span><span></span><span></span>
          </div>

          <div v-if="msg.cypher" class="cypher">
            <div class="cypher-header">
              <span>📝 生成的查询</span>
              <el-button size="small" text @click="copyCypher(msg.cypher)">复制</el-button>
            </div>
            <pre>{{ msg.cypher }}</pre>
          </div>

          <div v-if="msg.steps && msg.steps.length > 0" class="steps">
            <el-steps :active="msg.steps.length" finish-status="success" align-center>
              <el-step v-for="(step, idx) in msg.steps" :key="idx" :title="step.name" size="small" />
            </el-steps>
          </div>

          <!-- 多智能体详情面板 -->
          <div v-if="msg.mode === 'multi-agent' && msg.agentDetails" class="agent-details">
            <div class="agent-details-header" @click="toggleAgentDetails(msg.id)">
              <span>🤖 多智能体执行详情</span>
              <span class="execution-time">{{ formatTime(msg.agentDetails.executionTime) }}</span>
              <el-icon :class="{ rotated: expandedAgentDetails === msg.id }">
                <ArrowDown />
              </el-icon>
            </div>
            <div v-show="expandedAgentDetails === msg.id" class="agent-details-content">
              <!-- 工作流步骤 -->
              <div class="workflow-steps">
                <div class="section-title">执行流程</div>
                <el-steps :active="msg.agentDetails.workflowSteps.length" finish-status="success" simple>
                  <el-step 
                    v-for="(step, idx) in msg.agentDetails.workflowSteps" 
                    :key="idx" 
                    :title="step.agent"
                    :description="step.action"
                    :status="step.status"
                  />
                </el-steps>
              </div>
              <!-- 各智能体输出 -->
              <div class="agent-outputs">
                <div class="section-title">智能体输出</div>
                <div v-for="(output, agent) in msg.agentDetails.agentOutputs" :key="agent" class="agent-output-item">
                  <div class="agent-name">{{ getAgentDisplayName(agent) }}</div>
                  <div class="agent-output-text">{{ output }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref="bottomRef"></div>
    </div>

    <!-- 多智能体状态面板 -->
    <AgentStatusPanel
        v-if="requestMode === 'multi-agent' && showAgentPanel"
        :agents-status="agentsStatus"
        :current-step="currentStep"
        :execution-time="executionTime"
        :workflow-steps="workflowSteps"
        :agent-outputs="agentOutputs"
        @close="showAgentPanel = false"
        @clear-workflow="clearWorkflow"
    />

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
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, ArrowDown } from '@element-plus/icons-vue'
import { kgApi } from '../api'
import historyService from '../services/historyService'
import G6 from '@antv/g6'
import AgentStatusPanel from './AgentStatusPanel.vue'

const props = defineProps({
  initialConversation: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['conversation-saved'])

// 流式模式示例问题
const streamQuestions = [
  '什么是齐套率？',
  '介绍一下供应链管理的基本概念',
  '物料编码的作用是什么？',
  '供应商评估的主要指标有哪些？'
]

// 多智能体模式示例问题
const multiAgentQuestions = [
  '分析东四平台项目的物料齐套情况如何？缺哪些料？',
  '标准件厂最近交付率低，会对那些项目产生风险？需要预警吗？',
  '压力传感器严重缺货，现有采购订单无法按时到货，请给出采购建议。',
  '东四平台项目的陀螺仪目前库存为0，在途订单承诺交期已过，距离投产还有5天，请分析影响、评估风险并给出处理方案。'
]

// 根据模式动态获取示例问题
const exampleQuestions = computed(() => {
  return requestMode.value === 'multi-agent' ? multiAgentQuestions : streamQuestions
})

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
const expandedAgentDetails = ref(null)

// 多智能体状态
const agentsStatus = ref({
  conductor: 'idle',
  data_knowledge: 'idle',
  analysis: 'idle',
  risk: 'idle',
  decision: 'idle'
})
const currentStep = ref('')
const executionTime = ref(0)
const workflowSteps = ref([])
const agentOutputs = ref({})
const showAgentPanel = ref(true)

const nodeColors = {
  Project: '#1890ff',
  Material: '#52c41a',
  Supplier: '#eb2f96',
  Inventory: '#faad14',
  PurchaseOrder: '#722ed1'
}

const scrollToBottom = async () => {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
}

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
    messages: JSON.parse(JSON.stringify(messages.value)),
    timestamp: new Date().toISOString()
  }

  historyService.saveConversation(conversation)
  if (!currentConversationId.value) {
    currentConversationId.value = conversation.id
  }
  emit('conversation-saved')
}

const loadConversation = (conversation) => {
  if (conversation && conversation.messages) {
    messages.value = conversation.messages
    currentConversationId.value = conversation.id
    scrollToBottom()
  }
}

const newConversation = () => {
  messages.value = []
  currentConversationId.value = null
  inputValue.value = ''
  scrollToBottom()
}

const clearMessages = () => {
  messages.value = []
  currentConversationId.value = null
}

const copyCypher = (cypher) => {
  navigator.clipboard.writeText(cypher)
  ElMessage.success('已复制到剪贴板')
}

const fetchSubgraph = async (cypher) => {
  if (!cypher) return null
  try {
    const subgraphCypher = `
      MATCH (n)-[r]-(m)
      WHERE (n:Project OR n:Material OR n:Supplier OR n:Inventory OR n:PurchaseOrder OR n:WorkOrder)
        AND (m:Project OR m:Material OR m:Supplier OR m:Inventory OR m:PurchaseOrder OR m:WorkOrder)
      RETURN n, r, m
      LIMIT 100
    `
    const res = await kgApi.executeQuery({ cypher: subgraphCypher })
    console.log('图谱查询结果:', res)
    if (res.data && res.data.success && res.data.data && res.data.data.length > 0) {
      return convertToGraphData(res.data.data)
    }
  } catch (error) {
    console.error('获取子图失败:', error)
  }
  return null
}

const convertToGraphData = (data) => {
  const nodesMap = new Map()
  const edges = []
  const edgeIdMap = new Map()
  let edgeIndex = 0
  
  console.log('原始数据:', data)
  
  data.forEach(record => {
    // 处理源节点 n
    if (record.n) {
      processNode(record.n)
    }
    
    // 处理目标节点 m
    if (record.m) {
      processNode(record.m)
    }
    
    // 处理关系 r
    if (record.r) {
      processRelationship(record.r)
    }
    
    // 兼容后端返回的字典格式（每个记录就是一个节点或关系）
    // 如果记录本身有 labels 或 type 字段，说明是直接返回的节点/边
    if (record.labels || record.type) {
      if (record.source === undefined) {
        // 这是一个节点
        processNode(record)
      } else {
        // 这是一条边
        processRelationship(record)
      }
    }
  })
  
  function processNode(node) {
    const nodeId = node.id
    if (!nodesMap.has(nodeId)) {
      const labels = node.labels || []
      const props = node.properties || node
      const nodeType = labels[0] || node.type || 'Unknown'
      const label = props.name || props.label || nodeType || 'Unknown'
      nodesMap.set(nodeId, {
        id: nodeId,
        label: label,
        nodeType: nodeType
      })
      console.log(`添加节点: ${nodeId} - ${label} (${nodeType})`)
    }
  }
  
  function processRelationship(rel) {
    const source = String(rel.start !== undefined ? rel.start : rel.source)
    const target = String(rel.end !== undefined ? rel.end : rel.target)
    const relType = rel.type || rel.label || 'UNKNOWN'
    const relId = rel.id || `${source}_${target}_${relType}_${edgeIndex++}`
    
    // 确保源节点和目标节点存在
    if (!nodesMap.has(source)) {
      nodesMap.set(source, { id: source, label: `Node_${source}`, nodeType: 'Unknown' })
    }
    if (!nodesMap.has(target)) {
      nodesMap.set(target, { id: target, label: `Node_${target}`, nodeType: 'Unknown' })
    }
    
    // 避免重复边
    const edgeKey = `${source}_${target}_${relType}_${relId}`
    if (!edgeIdMap.has(edgeKey)) {
      edgeIdMap.set(edgeKey, true)
      edges.push({
        id: relId,
        source: source,
        target: target,
        label: relType
      })
      console.log(`添加边: ${source} -> ${target} (${relType})`)
    }
  }
  
  console.log(`图谱数据转换完成: ${nodesMap.size} 个节点, ${edges.length} 条边`)
  return { nodes: Array.from(nodesMap.values()), edges }
}

const renderSubgraph = (msgId, graphData) => {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return
  const container = subgraphRefs.value[msgId]
  if (!container) return
  const width = container.clientWidth || 400
  const height = 280
  if (subgraphInstances.value[msgId]) {
    subgraphInstances.value[msgId].forEach(g => g?.destroy())
  }
  subgraphInstances.value[msgId] = []
  const graph = new G6.Graph({
    container, width, height,
    modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node'] },
    layout: { type: 'dagre', rankdir: 'LR', nodesep: 40, ranksep: 60 },
    defaultNode: {
      type: 'rect', size: [100, 36],
      style: { radius: 6, fill: (node) => nodeColors[node.nodeType] || '#999', stroke: '#333', lineWidth: 1, cursor: 'pointer' },
      labelCfg: { style: { fill: '#fff', fontSize: 11 }, position: 'center' }
    },
    defaultEdge: {
      style: { stroke: '#1890ff', lineWidth: 2, endArrow: true, cursor: 'pointer' },
      labelCfg: { autoRotate: true, style: { fill: '#666', fontSize: 10 } }
    }
  })
  const nodes = graphData.nodes.map(node => ({ id: String(node.id), label: node.label, nodeType: node.nodeType }))
  const edges = graphData.edges.map((edge, index) => ({ 
    id: edge.id || `edge_${index}_${edge.source}_${edge.target}`, 
    source: String(edge.source), 
    target: String(edge.target), 
    label: edge.label 
  }))
  console.log(`渲染图谱: ${nodes.length} 个节点, ${edges.length} 条边`)
  graph.data({ nodes, edges })
  graph.render()
  graph.fitView(20)
  subgraphInstances.value[msgId].push(graph)
}

const setSubgraphRef = (msgId, el) => {
  if (el) { subgraphRefs.value[msgId] = el }
}

const toggleSubgraph = (msgId) => {
  if (expandedSubgraph.value === msgId) {
    expandedSubgraph.value = null
  } else {
    expandedSubgraph.value = msgId
    setTimeout(() => {
      const msg = messages.value.find(m => m.id === msgId)
      if (msg && msg.subgraph) { renderSubgraph(msgId, msg.subgraph) }
    }, 100)
  }
}

const toggleAgentDetails = (msgId) => {
  if (expandedAgentDetails.value === msgId) {
    expandedAgentDetails.value = null
  } else {
    expandedAgentDetails.value = msgId
  }
}

const formatTime = (ms) => {
  if (!ms) return '0ms'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(1)}s`
}

const resetAgentStatus = () => {
  agentsStatus.value = { conductor: 'idle', data_knowledge: 'idle', analysis: 'idle', risk: 'idle', decision: 'idle' }
  workflowSteps.value = []
  agentOutputs.value = {}
  currentStep.value = ''
}

const clearWorkflow = () => { workflowSteps.value = [] }

const getAgentDisplayName = (agentKey) => {
  const names = { conductor: '指挥协调器', data_knowledge: '数据知识', analysis: '分析智能体', risk: '风险智能体', decision: '决策智能体' }
  return names[agentKey] || agentKey
}

const sendMultiAgentMessage = async (question) => {
  loading.value = true
  loadingText.value = '启动多智能体协作...'
  resetAgentStatus()
  showAgentPanel.value = true
  const startTime = Date.now()
  const msgId = Date.now() + 1
  const streamingMsg = { 
    id: msgId, 
    role: 'assistant', 
    content: '', 
    isStreaming: true, 
    mode: 'multi-agent',
    agentDetails: {
      workflowSteps: [],
      agentOutputs: {},
      executionTime: 0
    }
  }
  messages.value.push(streamingMsg)
  await scrollToBottom()
  try {
    await kgApi.askQuestionWithAgents(question, {
      onAgentStart: (agent, message) => {
        agentsStatus.value[agent] = 'running'
        currentStep.value = message
        const step = { agent: getAgentDisplayName(agent), action: message, status: 'running' }
        workflowSteps.value.push(step)
        agentOutputs.value[agent] = '执行中...'
        loadingText.value = message
        
        // 保存到消息中
        const msg = messages.value.find(m => m.id === msgId)
        if (msg && msg.agentDetails) {
          msg.agentDetails.workflowSteps.push({...step})
        }
      },
      onAgentComplete: (agent, result) => {
        agentsStatus.value[agent] = 'completed'
        const step = workflowSteps.value.find(s => s.agent === getAgentDisplayName(agent))
        if (step) step.status = 'completed'
        agentOutputs.value[agent] = result?.substring?.(0, 100) || '完成'
        
        // 更新消息中的状态
        const msg = messages.value.find(m => m.id === msgId)
        if (msg && msg.agentDetails) {
          const msgStep = msg.agentDetails.workflowSteps.find(s => s.agent === getAgentDisplayName(agent))
          if (msgStep) msgStep.status = 'completed'
          msg.agentDetails.agentOutputs[agent] = result
        }
      },
      onAgentOutput: (agent, output) => { 
        agentOutputs.value[agent] = output 
        // 更新消息中的输出
        const msg = messages.value.find(m => m.id === msgId)
        if (msg && msg.agentDetails) {
          msg.agentDetails.agentOutputs[agent] = output
        }
      },
      onComplete: (answer, details) => {
        const msg = messages.value.find(m => m.id === msgId)
        if (msg) { 
          msg.content = answer; 
          msg.isStreaming = false; 
          msg.agentDetails.executionTime = Date.now() - startTime
          if (details) {
            msg.agentDetails.intermediateResults = details
          }
        }
        loading.value = false
        executionTime.value = Date.now() - startTime
        ElMessage.success(`多智能体协作完成，耗时 ${executionTime.value}ms`)
        saveCurrentConversation()
      },
      onError: (error) => {
        const msg = messages.value.find(m => m.id === msgId)
        if (msg) { msg.content = `处理失败: ${error}`; msg.isStreaming = false }
        loading.value = false
        ElMessage.error('问答失败: ' + error)
      }
    })
  } catch (error) {
    const msg = messages.value.find(m => m.id === msgId)
    if (msg) { msg.content = `请求失败: ${error.message}`; msg.isStreaming = false }
    loading.value = false
    ElMessage.error('请求失败')
  }
}

const sendStreamMessage = async (question) => {
  loading.value = true
  loadingText.value = '正在理解问题...'
  const msgId = Date.now() + 1
  const streamingMsg = { id: msgId, role: 'assistant', content: '', isStreaming: true, cypher: null, subgraph: null, mode: 'stream' }
  messages.value.push(streamingMsg)
  await scrollToBottom()
  let finalCypher = null
  try {
    await kgApi.askQuestionStream(question,
        (chunk) => { const msg = messages.value.find(m => m.id === msgId); if (msg) { msg.content += chunk; scrollToBottom() } },
        async (fullAnswer, cypher) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) { msg.isStreaming = false; msg.cypher = cypher; finalCypher = cypher }
          loading.value = false
          ElMessage.success('回答完成')
          if (finalCypher) {
            const subgraphData = await fetchSubgraph(finalCypher)
            const msg = messages.value.find(m => m.id === msgId)
            if (msg && subgraphData && subgraphData.nodes.length > 0) { msg.subgraph = subgraphData }
          }
          saveCurrentConversation()
        },
        (error) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) { msg.content = `生成回答失败: ${error}`; msg.isStreaming = false }
          loading.value = false
          ElMessage.error('问答失败: ' + error)
        }
    )
  } catch (error) {
    const msg = messages.value.find(m => m.id === msgId)
    if (msg) { msg.content = `请求失败: ${error.message}`; msg.isStreaming = false }
    loading.value = false
    ElMessage.error('请求失败')
  }
}

const sendAsyncMessage = async (question) => {
  loading.value = true
  loadingText.value = '创建任务...'
  const msgId = Date.now() + 1
  const tempMsg = { id: msgId, role: 'assistant', content: '', steps: [] }
  messages.value.push(tempMsg)
  await scrollToBottom()
  try {
    await kgApi.askQuestionAsync(question,
        (stepName, steps) => { const msg = messages.value.find(m => m.id === msgId); if (msg) { msg.steps = steps || []; loadingText.value = stepName } },
        async (answer, cypher) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) { msg.content = answer; msg.cypher = cypher }
          if (cypher) {
            const subgraphData = await fetchSubgraph(cypher)
            const msg = messages.value.find(m => m.id === msgId)
            if (msg && subgraphData && subgraphData.nodes.length > 0) { msg.subgraph = subgraphData }
          }
          loading.value = false
          ElMessage.success('回答完成')
          saveCurrentConversation()
        },
        (error) => { const msg = messages.value.find(m => m.id === msgId); if (msg) { msg.content = `处理失败: ${error}` }; loading.value = false; ElMessage.error('问答失败: ' + error) }
    )
  } catch (error) {
    const msg = messages.value.find(m => m.id === msgId)
    if (msg) { msg.content = `请求失败: ${error.message}` }
    loading.value = false
    ElMessage.error('请求失败')
  }
}

const sendSyncMessage = async (question) => {
  loading.value = true
  loadingText.value = '处理中...'
  try {
    const res = await kgApi.askQuestion(question)
    const msgId = Date.now() + 1
    const assistantMsg = { id: msgId, role: 'assistant', content: res.data.answer, cypher: res.data.cypher, subgraph: null }
    messages.value.push(assistantMsg)
    await scrollToBottom()
    if (res.data.cypher) {
      const subgraphData = await fetchSubgraph(res.data.cypher)
      const msg = messages.value.find(m => m.id === msgId)
      if (msg && subgraphData && subgraphData.nodes.length > 0) { msg.subgraph = subgraphData }
    }
    saveCurrentConversation()
  } catch (error) {
    console.error('问答失败:', error)
    ElMessage.error('问答失败，请稍后重试')
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: '抱歉，处理您的问题时出错了。请稍后再试。' })
  } finally { loading.value = false }
}

const sendMessage = async () => {
  const question = inputValue.value.trim()
  if (!question) return
  const userMsg = { id: Date.now(), role: 'user', content: question }
  messages.value.push(userMsg)
  inputValue.value = ''
  await scrollToBottom()
  if (requestMode.value === 'multi-agent') {
    await sendMultiAgentMessage(question)
  } else if (requestMode.value === 'stream') {
    await sendStreamMessage(question)
  } else if (requestMode.value === 'async') {
    await sendAsyncMessage(question)
  } else {
    await sendSyncMessage(question)
  }
  saveCurrentConversation()
}

watch(() => props.initialConversation, (conv) => {
  if (conv) { loadConversation(conv) }
}, { immediate: true, deep: true })

onUnmounted(() => {
  Object.values(subgraphInstances.value).forEach(instances => { instances.forEach(g => g?.destroy()) })
})

defineExpose({ loadConversation, saveCurrentConversation, newConversation, clearMessages })
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
.mode-badge {
  margin-bottom: 8px;
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
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}
.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #8c9aa8;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}
.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
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