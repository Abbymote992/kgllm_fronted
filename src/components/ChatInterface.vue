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
        <p>试试问我：<br />通信卫星平台项目需要什么物料？</p>
      </div>

      <div v-for="msg in messages" :key="msg.id" :class="['message', msg.role]">
        <div class="avatar">
          <el-avatar :size="36" :style="{ background: msg.role === 'user' ? '#1890ff' : '#52c41a' }">
            {{ msg.role === 'user' ? '我' : 'AI' }}
          </el-avatar>
        </div>
        <div class="content">
          <div class="text">{{ msg.content }}</div>

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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound } from '@element-plus/icons-vue'
import { kgApi } from '../api'

const messages = ref([])
const inputValue = ref('')
const loading = ref(false)
const loadingText = ref('准备就绪...')
const requestMode = ref('stream')  // stream, async, sync
const messagesRef = ref(null)
const bottomRef = ref(null)

let currentStreamingMessage = null

const scrollToBottom = async () => {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
}

// 发送消息（根据模式选择）
const sendMessage = async () => {
  const question = inputValue.value.trim()
  if (!question) return

  // 添加用户消息
  messages.value.push({
    id: Date.now(),
    role: 'user',
    content: question
  })

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
}

// 流式模式（方案三）- 推荐
const sendStreamMessage = async (question) => {
  loading.value = true
  loadingText.value = '正在理解问题...'

  // 创建一个临时的AI消息用于流式显示
  const msgId = Date.now() + 1
  const streamingMsg = {
    id: msgId,
    role: 'assistant',
    content: '',
    isStreaming: true,
    cypher: null
  }
  messages.value.push(streamingMsg)
  await scrollToBottom()

  try {
    await kgApi.askQuestionStream(
        question,
        // onChunk - 接收流式内容
        (chunk) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.content += chunk
            scrollToBottom()
          }
        },
        // onComplete - 完成
        (fullAnswer, cypher) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.isStreaming = false
            msg.cypher = cypher
          }
          loading.value = false
          ElMessage.success('回答完成')
        },
        // onError - 错误
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

// 异步模式（方案五）- 适合长耗时
const sendAsyncMessage = async (question) => {
  loading.value = true
  loadingText.value = '创建任务...'

  // 创建临时消息
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
        // onProgress - 进度更新
        (stepName, steps) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.steps = steps || []
            loadingText.value = stepName
          }
        },
        // onComplete - 完成
        (answer, cypher) => {
          const msg = messages.value.find(m => m.id === msgId)
          if (msg) {
            msg.content = answer
            msg.cypher = cypher
          }
          loading.value = false
          ElMessage.success('回答完成')
        },
        // onError - 错误
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

// 同步模式（原有，带缓存）
const sendSyncMessage = async (question) => {
  loading.value = true
  loadingText.value = '处理中...'

  try {
    const res = await kgApi.askQuestion(question)

    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: res.data.answer,
      cypher: res.data.cypher
    })

    await scrollToBottom()
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

const clearMessages = () => {
  messages.value = []
}

const copyCypher = (cypher) => {
  navigator.clipboard.writeText(cypher)
  ElMessage.success('已复制到剪贴板')
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.chat-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
}

.chat-header h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.mode-selector {
  margin: 12px 0;
}

.chat-header .subtitle {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #909399;
}

.empty .el-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #c0c4cc;
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
  max-width: 70%;
}

.message.user .content {
  background: #1890ff;
  color: white;
  padding: 10px 14px;
  border-radius: 18px 4px 18px 18px;
}

.message.assistant .content {
  background: #f4f4f5;
  color: #333;
  padding: 10px 14px;
  border-radius: 4px 18px 18px 18px;
}

.text {
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.streaming-cursor {
  display: inline-block;
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.cypher {
  margin-top: 12px;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.cypher-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d2d;
  color: #d4d4d4;
  font-size: 12px;
}

.cypher pre {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.steps {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #e4e7ed;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing span {
  width: 8px;
  height: 8px;
  background: #909399;
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
  color: #909399;
  margin-top: 8px;
}

.chat-input {
  padding: 20px;
  border-top: 1px solid #e4e7ed;
  background: #fff;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}
</style>