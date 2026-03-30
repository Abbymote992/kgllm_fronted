<template>
  <div class="chat-interface">
    <div class="chat-header">
      <h3>💬 智能问答</h3>
      <p>基于知识图谱的供应链问答</p>
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
          <div v-if="msg.cypher" class="cypher">
            <div class="cypher-header">
              <span>📝 生成的查询</span>
              <el-button size="small" text @click="copy(msg.cypher)">复制</el-button>
            </div>
            <pre>{{ msg.cypher }}</pre>
          </div>
        </div>
      </div>

      <div v-if="loading" class="message assistant">
        <div class="avatar"><el-avatar :size="36" style="background:#52c41a">AI</el-avatar></div>
        <div class="content"><div class="typing"><span></span><span></span><span></span></div></div>
      </div>

      <div ref="bottomRef"></div>
    </div>

    <div class="chat-input">
      <el-input
          v-model="inputValue"
          type="textarea"
          :rows="3"
          placeholder="输入问题，如：通信卫星平台项目需要什么物料？"
          @keydown.enter.prevent="send"
          :disabled="loading"
      />
      <div class="actions">
        <el-button type="primary" @click="send" :loading="loading">发送</el-button>
        <el-button @click="clear">清空</el-button>
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
const messagesRef = ref(null)
const bottomRef = ref(null)

const scrollToBottom = async () => {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
}

const send = async () => {
  const q = inputValue.value.trim()
  if (!q) return

  messages.value.push({ id: Date.now(), role: 'user', content: q })
  inputValue.value = ''
  await scrollToBottom()

  loading.value = true
  try {
    const res = await kgApi.askQuestion(q)
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: res.data.answer,
      cypher: res.data.cypher
    })
    await scrollToBottom()
  } catch (err) {
    ElMessage.error('问答失败')
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: '抱歉，出错了' })
  } finally {
    loading.value = false
  }
}

const clear = () => { messages.value = [] }
const copy = (text) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}
.chat-header {
  padding: 20px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
}
.chat-header h3 { margin: 0 0 4px; }
.chat-header p { margin: 0; font-size: 13px; color: #909399; }
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
.message {
  display: flex;
  margin-bottom: 20px;
}
.message.user { flex-direction: row-reverse; }
.message.user .avatar { margin-left: 12px; }
.message.assistant .avatar { margin-right: 12px; }
.content { max-width: 70%; }
.message.user .content {
  background: #1890ff;
  color: white;
  padding: 10px 14px;
  border-radius: 18px 4px 18px 18px;
}
.message.assistant .content {
  background: #f4f4f5;
  padding: 10px 14px;
  border-radius: 4px 18px 18px 18px;
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
  padding: 8px 12px;
  background: #2d2d2d;
  color: #d4d4d4;
  font-size: 12px;
}
.cypher pre {
  margin: 0;
  padding: 12px;
  color: #d4d4d4;
  font-size: 12px;
  overflow-x: auto;
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
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-10px); opacity: 1; }
}
.chat-input {
  padding: 20px;
  border-top: 1px solid #e4e7ed;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}
</style>