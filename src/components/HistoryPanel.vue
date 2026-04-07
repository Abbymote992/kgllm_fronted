<!-- frontend-vue/src/components/HistoryPanel.vue -->
<template>
  <div class="history-panel">
    <div class="panel-header">
      <h3>
        <el-icon><ChatLineRound /></el-icon>
        对话历史
      </h3>
      <div class="header-actions">
        <el-button
            size="small"
            type="primary"
            plain
            @click="newConversation"
            :icon="Plus"
        >
          新对话
        </el-button>
        <el-button
            v-if="history.length > 0"
            size="small"
            text
            @click="clearAll"
            :icon="Delete"
        >
          清空
        </el-button>
      </div>
    </div>

    <div class="history-list" v-if="history.length > 0">
      <div
          v-for="item in history"
          :key="item.id"
          :class="['history-item', { active: activeId === item.id }]"
          @click="selectConversation(item)"
      >
        <div class="item-content">
          <div class="item-title">{{ item.title || '未命名对话' }}</div>
          <div class="item-preview">{{ item.preview || '暂无内容' }}</div>
          <div class="item-footer">
            <span class="item-time">{{ formatTime(item.timestamp || item.createdAt) }}</span>
            <span class="item-count">{{ item.messages?.length || 0 }}条消息</span>
          </div>
        </div>
        <div class="item-actions">
          <el-button
              size="small"
              text
              @click.stop="deleteItem(item.id)"
              :icon="Delete"
              class="delete-btn"
          />
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <el-icon :size="48"><ChatDotRound /></el-icon>
      <p>暂无对话历史</p>
      <p class="hint">开始提问后会自动保存</p>
      <el-button type="primary" plain size="small" @click="newConversation" :icon="Plus">
        开始新对话
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, ChatDotRound, ChatLineRound, Plus } from '@element-plus/icons-vue'
import historyService from '../services/historyService'

const props = defineProps({
  activeId: {
    type: [Number, String],
    default: null
  }
})

const emit = defineEmits(['select', 'new'])

const history = ref([])

const loadHistory = () => {
  history.value = historyService.getHistory()
}

const selectConversation = (item) => {
  emit('select', item)
}

const newConversation = () => {
  emit('new')
}

const deleteItem = async (id) => {
  try {
    await ElMessageBox.confirm('确定删除这条对话吗？', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    historyService.deleteConversation(id)
    loadHistory()
    if (props.activeId === id) {
      emit('select', null)
    }
    ElMessage.success('已删除')
  } catch {
    // 取消删除
  }
}

const clearAll = async () => {
  try {
    await ElMessageBox.confirm('确定清空所有对话历史吗？', '提示', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消'
    })
    historyService.clearHistory()
    loadHistory()
    emit('select', null)
    ElMessage.success('已清空')
  } catch {
    // 取消
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return '未知时间'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

onMounted(() => {
  loadHistory()
})

defineExpose({ loadHistory })
</script>

<style scoped>
.history-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.panel-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1f2f3d;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.history-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: #fafbfc;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.history-item:hover {
  background: #f5f7fa;
  transform: translateX(2px);
}

.history-item.active {
  background: #e8f4ff;
  border-color: #1890ff;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-weight: 500;
  font-size: 14px;
  color: #2c3e50;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-preview {
  font-size: 12px;
  color: #8c9aa8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8px;
}

.item-footer {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #b0bec5;
}

.item-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.item-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

.item-actions {
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: 8px;
}

.history-item:hover .item-actions {
  opacity: 1;
}

.delete-btn {
  color: #f56c6c;
}

.delete-btn:hover {
  color: #f23030;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-state .el-icon {
  color: #d0d7de;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #8c9aa8;
}

.empty-state .hint {
  font-size: 12px;
  color: #b0bec5;
  margin-bottom: 20px;
}
</style>