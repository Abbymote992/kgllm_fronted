<!-- src/components/AgentStatusPanel.vue -->
<template>
  <div
      class="agent-status-panel"
      :style="panelStyle"
      @mousedown="startDrag"
  >
    <div class="panel-header" @click="collapsed = !collapsed">
      <div class="header-left">
        <span class="icon">🤖</span>
        <span class="title">多智能体协作状态</span>
        <span class="badge" :class="overallStatus">{{ overallStatusText }}</span>
      </div>
      <div class="header-actions">
        <el-icon @click.stop="minimizePanel" class="action-icon">
          <Minus />
        </el-icon>
        <el-icon @click.stop="$emit('close')" class="action-icon">
          <Close />
        </el-icon>
        <el-icon :class="{ rotated: !collapsed }" class="action-icon">
          <ArrowDown />
        </el-icon>
      </div>
    </div>

    <div v-show="!collapsed" class="panel-content">
      <!-- 整体进度 -->
      <div class="overall-progress" v-if="currentStep">
        <div class="step-info">
          <span class="step-name">
            <el-icon class="loading-icon" v-if="isProcessing"><Loading /></el-icon>
            {{ currentStep }}
          </span>
          <span class="step-time">{{ executionTime }}ms</span>
        </div>
        <el-progress :percentage="progressPercentage" :stroke-width="6" :status="progressStatus" />
      </div>

      <!-- 各智能体状态 -->
      <div class="agents-list">
        <div
            v-for="agent in agentsList"
            :key="agent.name"
            :class="['agent-item', agent.status]"
        >
          <div class="agent-icon">{{ agent.icon }}</div>
          <div class="agent-info">
            <div class="agent-name">
              {{ agent.name }}
              <el-tag :type="getStatusType(agent.status)" size="small" effect="plain">
                {{ getStatusText(agent.status) }}
              </el-tag>
            </div>
            <div class="agent-desc">{{ agent.description }}</div>
            <div v-if="agent.output && !isAgentOutputEmpty(agent.output)" class="agent-output">
              <el-icon><View /></el-icon>
              {{ truncateOutput(agent.output) }}
            </div>
          </div>
          <div v-if="agent.status === 'running'" class="agent-spinner">
            <el-icon class="is-loading"><Loading /></el-icon>
          </div>
        </div>
      </div>

      <!-- 协作流程图 -->
      <div class="workflow" v-if="workflowSteps.length > 0">
        <div class="workflow-title">
          <span>🔄 智能体协作流程</span>
          <el-button size="small" text @click="$emit('clear-workflow')">清空</el-button>
        </div>
        <div class="workflow-steps">
          <div
              v-for="(step, idx) in workflowSteps"
              :key="idx"
              :class="['workflow-step', step.status]"
          >
            <div class="step-index">{{ idx + 1 }}</div>
            <div class="step-content">
              <div class="step-agent">{{ step.agent }}</div>
              <div class="step-action">{{ step.action }}</div>
            </div>
            <el-icon v-if="idx < workflowSteps.length - 1" class="step-arrow">
              <ArrowRight />
            </el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ArrowDown, ArrowRight, Loading, Close, Minus, View } from '@element-plus/icons-vue'

const props = defineProps({
  agentsStatus: {
    type: Object,
    default: () => ({
      conductor: 'idle',
      data_knowledge: 'idle',
      analysis: 'idle',
      risk: 'idle',
      decision: 'idle'
    })
  },
  currentStep: {
    type: String,
    default: ''
  },
  executionTime: {
    type: Number,
    default: 0
  },
  workflowSteps: {
    type: Array,
    default: () => []
  },
  agentOutputs: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'clear-workflow'])

// 面板状态
const collapsed = ref(false)
const isMinimized = ref(false)

// 拖拽相关
const panelPosition = ref({ x: window.innerWidth - 420, y: window.innerHeight - 500 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

const panelStyle = computed(() => {
  if (isMinimized.value) {
    return {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: 'auto',
      minWidth: '200px'
    }
  }
  return {
    position: 'fixed',
    left: `${panelPosition.value.x}px`,
    top: `${panelPosition.value.y}px`,
    width: '380px'
  }
})

// 计算属性
const isProcessing = computed(() => {
  return Object.values(props.agentsStatus).some(s => s === 'running')
})

const overallStatusText = computed(() => {
  const statuses = Object.values(props.agentsStatus)
  if (statuses.every(s => s === 'completed')) return '✓ 完成'
  if (statuses.some(s => s === 'running')) return '⏳ 执行中'
  if (statuses.some(s => s === 'failed')) return '✗ 失败'
  return '● 待命'
})

const overallStatus = computed(() => {
  const statuses = Object.values(props.agentsStatus)
  if (statuses.every(s => s === 'completed')) return 'success'
  if (statuses.some(s => s === 'running')) return 'processing'
  if (statuses.some(s => s === 'failed')) return 'danger'
  return 'info'
})

const progressPercentage = computed(() => {
  const completed = Object.values(props.agentsStatus).filter(
      s => s === 'completed'
  ).length
  return (completed / 5) * 100
})

const progressStatus = computed(() => {
  if (progressPercentage.value === 100) return 'success'
  return ''
})

const agentsList = computed(() => [
  {
    name: '指挥协调器',
    key: 'conductor',
    icon: '🎯',
    description: '任务调度与协调',
    status: props.agentsStatus.conductor,
    output: props.agentOutputs.conductor
  },
  {
    name: '数据知识智能体',
    key: 'data_knowledge',
    icon: '📚',
    description: '知识图谱查询与数据获取',
    status: props.agentsStatus.data_knowledge,
    output: props.agentOutputs.data_knowledge
  },
  {
    name: '分析智能体',
    key: 'analysis',
    icon: '📊',
    description: '数据深度分析与模式识别',
    status: props.agentsStatus.analysis,
    output: props.agentOutputs.analysis
  },
  {
    name: '风险智能体',
    key: 'risk',
    icon: '⚠️',
    description: '风险识别与评估',
    status: props.agentsStatus.risk,
    output: props.agentOutputs.risk
  },
  {
    name: '决策智能体',
    key: 'decision',
    icon: '💡',
    description: '决策建议生成',
    status: props.agentsStatus.decision,
    output: props.agentOutputs.decision
  }
])

// 方法
const getStatusType = (status) => {
  const types = {
    idle: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    idle: '待命',
    running: '执行中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || status
}

const isAgentOutputEmpty = (output) => {
  return !output || output === '执行中...' || output === '完成' || output === ''
}

const truncateOutput = (output, maxLen = 80) => {
  if (!output) return ''
  if (output.length <= maxLen) return output
  return output.substring(0, maxLen) + '...'
}

const minimizePanel = () => {
  isMinimized.value = !isMinimized.value
  if (!isMinimized.value) {
    collapsed.value = false
  } else {
    collapsed.value = true
  }
}

// 拖拽逻辑
const startDrag = (e) => {
  if (e.target.closest('.panel-header') &&
      !e.target.closest('.action-icon') &&
      !isMinimized.value) {
    isDragging.value = true
    dragStart.value = {
      x: e.clientX - panelPosition.value.x,
      y: e.clientY - panelPosition.value.y
    }

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }
}

const onDrag = (e) => {
  if (!isDragging.value) return

  let newX = e.clientX - dragStart.value.x
  let newY = e.clientY - dragStart.value.y

  newX = Math.max(0, Math.min(window.innerWidth - 400, newX))
  newY = Math.max(0, Math.min(window.innerHeight - 100, newY))

  panelPosition.value = { x: newX, y: newY }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onMounted(() => {
  const savedPos = localStorage.getItem('agentPanelPosition')
  if (savedPos) {
    try {
      const pos = JSON.parse(savedPos)
      panelPosition.value = pos
    } catch (e) {}
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.agent-status-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: grab;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  user-select: none;
}

.panel-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left .icon {
  font-size: 20px;
}

.header-left .title {
  font-weight: 600;
  font-size: 14px;
}

.badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.badge.success {
  background: #52c41a;
  color: #fff;
}

.badge.processing {
  background: #1890ff;
  color: #fff;
}

.badge.danger {
  background: #f5222d;
  color: #fff;
}

.badge.info {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-icon {
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.action-icon:hover {
  opacity: 1;
}

.rotated {
  transform: rotate(180deg);
}

.panel-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.overall-progress {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.step-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.step-name {
  color: #1890ff;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.step-time {
  color: #8c9aa8;
}

.agents-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.agent-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px;
  background: #fafbfc;
  border-radius: 8px;
  border-left: 3px solid #d0d7de;
  transition: all 0.2s;
}

.agent-item.running {
  border-left-color: #1890ff;
  background: #e8f4ff;
}

.agent-item.completed {
  border-left-color: #52c41a;
}

.agent-item.failed {
  border-left-color: #f5222d;
}

.agent-icon {
  font-size: 24px;
}

.agent-info {
  flex: 1;
}

.agent-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-weight: 500;
  font-size: 13px;
}

.agent-desc {
  font-size: 11px;
  color: #8c9aa8;
  margin-bottom: 4px;
}

.agent-output {
  font-size: 11px;
  color: #5a6874;
  margin-top: 4px;
  padding: 4px 6px;
  background: #fff;
  border-radius: 4px;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 4px;
}

.agent-spinner {
  color: #1890ff;
}

.workflow {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.workflow-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #1f2f3d;
}

.workflow-steps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.workflow-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 20px;
  font-size: 11px;
}

.workflow-step.completed {
  background: #f6ffed;
  color: #52c41a;
}

.workflow-step.running {
  background: #e8f4ff;
  color: #1890ff;
}

.step-index {
  width: 20px;
  height: 20px;
  background: #d0d7de;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
}

.workflow-step.completed .step-index {
  background: #52c41a;
  color: #fff;
}

.workflow-step.running .step-index {
  background: #1890ff;
  color: #fff;
}

.step-arrow {
  color: #d0d7de;
  font-size: 14px;
}

.panel-content::-webkit-scrollbar {
  width: 4px;
}

.panel-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}
</style>