<template>
  <div class="app">
    <div class="header">
      <div class="logo">
        <el-icon :size="24"><Connection /></el-icon>
        <span>供应链知识图谱系统</span>
      </div>
      <div class="tabs">
        <el-button :type="activeTab === 'chat' ? 'primary' : 'default'" @click="activeTab = 'chat'">
          <el-icon><ChatDotRound /></el-icon> 智能问答
        </el-button>
        <el-button :type="activeTab === 'graph' ? 'primary' : 'default'" @click="activeTab = 'graph'">
          <el-icon><Share /></el-icon> 知识图谱
        </el-button>
      </div>
    </div>
    <div class="main">
      <ChatInterface v-if="activeTab === 'chat'" />
      <KnowledgeGraph v-else />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Connection, ChatDotRound, Share } from '@element-plus/icons-vue'
import ChatInterface from './components/ChatInterface.vue'
import KnowledgeGraph from './components/KnowledgeGraph.vue'

const activeTab = ref('chat')
</script>

<style>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.header {
  height: 60px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 500;
  color: #1890ff;
}
.tabs {
  display: flex;
  gap: 12px;
}
.main {
  flex: 1;
  padding: 24px;
  background: #f0f2f5;
  overflow: auto;
}
</style>