<!-- frontend-vue/src/App.vue -->
<template>
  <div class="app">
    <!-- 顶部导航栏 -->
    <div class="header">
      <div class="logo">
        <span class="logo-icon">🔗</span>
        <span class="logo-text">供应链知识图谱系统</span>
      </div>
      <div class="tabs">
        <button
            :class="['tab-btn', { active: activeTab === 'chat' }]"
            @click="activeTab = 'chat'"
        >
          <span class="tab-icon">💬</span>
          <span>智能问答</span>
        </button>
        <button
            :class="['tab-btn', { active: activeTab === 'graph' }]"
            @click="activeTab = 'graph'"
        >
          <span class="tab-icon">🔗</span>
          <span>知识图谱</span>
        </button>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 聊天页面：左侧历史 + 右侧聊天 -->
      <div v-if="activeTab === 'chat'" class="chat-layout">
        <!-- 左侧历史面板 -->
        <div class="history-sidebar">
          <HistoryPanel
              ref="historyPanelRef"
              :activeId="currentConversationId"
              @select="loadConversation"
              @new="newConversation"
          />
        </div>

        <div class="chat-area">
          <ChatInterface
              v-if="true"
              ref="chatInterfaceRef"
          :key="currentConversationId"
          :initialConversation="selectedConversation"
          @conversation-saved="onConversationSaved"
          />
        </div>
      </div>

      <!-- 图谱页面：全屏显示 -->
      <div v-else class="graph-layout">
        <KnowledgeGraph />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ChatInterface from './components/ChatInterface.vue'
import KnowledgeGraph from './components/KnowledgeGraph.vue'
import HistoryPanel from './components/HistoryPanel.vue'

const activeTab = ref('chat')
const chatInterfaceRef = ref(null)
const historyPanelRef = ref(null)
const selectedConversation = ref(null)
const currentConversationId = ref(null)

const loadConversation = (conversation) => {
  console.log('=== App.vue loadConversation ===')
  console.log('conversation:', conversation)
  console.log('chatInterfaceRef.value:', chatInterfaceRef.value)
  console.log('chatInterfaceRef.value 的类型:', typeof chatInterfaceRef.value)

  if (chatInterfaceRef.value) {
    console.log('可用的方法:', Object.keys(chatInterfaceRef.value))
  }

  if (conversation) {
    selectedConversation.value = conversation
    currentConversationId.value = conversation.id

    if (chatInterfaceRef.value && typeof chatInterfaceRef.value.loadConversation === 'function') {
      console.log('调用 loadConversation')
      chatInterfaceRef.value.loadConversation(conversation)
    } else {
      console.error('loadConversation 方法不存在！')
      console.error('chatInterfaceRef.value 的内容:', chatInterfaceRef.value)
    }
  }
}

// 新建对话
const newConversation = () => {
  selectedConversation.value = null
  currentConversationId.value = null
  // 通知聊天组件清空
  if (chatInterfaceRef.value) {
    chatInterfaceRef.value.newConversation()
  }
}

// 对话保存后刷新历史列表
const onConversationSaved = () => {
  historyPanelRef.value?.loadHistory()
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f0f2f5;
}

.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部导航栏 */
.header {
  height: 60px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  z-index: 10;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(135deg, #1890ff, #52c41a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tabs {
  display: flex;
  gap: 8px;
  background: #f5f7fa;
  padding: 4px;
  border-radius: 12px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
  color: #5a6874;
}

.tab-btn:hover {
  background: #e8edf3;
  color: #1890ff;
}

.tab-btn.active {
  background: #ffffff;
  color: #1890ff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.tab-icon {
  font-size: 16px;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  overflow: hidden;
  padding: 20px;
}

/* 聊天页面布局 - 左右分栏 */
.chat-layout {
  display: flex;
  gap: 20px;
  height: 100%;
  overflow: hidden;
}

/* 左侧历史面板 */
.history-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

/* 右侧聊天区域 */
.chat-area {
  flex: 1;
  overflow: hidden;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

/* 图谱页面 - 全屏 */
.graph-layout {
  height: 100%;
  overflow: hidden;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

/* 响应式设计 - 小屏幕时收起历史面板 */
@media (max-width: 768px) {
  .main-content {
    padding: 12px;
  }

  .history-sidebar {
    width: 240px;
  }

  .header {
    padding: 0 16px;
  }

  .tab-btn {
    padding: 6px 12px;
  }

  .tab-btn span:last-child {
    display: none;
  }
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>