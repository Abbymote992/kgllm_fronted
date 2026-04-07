// frontend-vue/src/services/historyService.js
class HistoryService {
    constructor() {
        this.storageKey = 'chat_history'
        this.maxHistory = 50  // 最多保存50条对话
    }

    // 保存对话
    saveConversation(conversation) {
        const history = this.getHistory()

        // 检查是否已存在相同ID的对话
        const existingIndex = history.findIndex(item => item.id === conversation.id)

        if (existingIndex !== -1) {
            // 更新现有对话
            history[existingIndex] = {
                ...history[existingIndex],
                ...conversation,
                updatedAt: new Date().toISOString()
            }
        } else {
            // 添加新对话到开头
            history.unshift({
                ...conversation,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        }

        // 限制数量
        while (history.length > this.maxHistory) {
            history.pop()
        }

        localStorage.setItem(this.storageKey, JSON.stringify(history))
        return true
    }

    // 获取所有历史记录
    getHistory() {
        try {
            const data = localStorage.getItem(this.storageKey)
            return data ? JSON.parse(data) : []
        } catch (error) {
            console.error('读取历史记录失败:', error)
            return []
        }
    }

    // 获取单条对话
    getConversation(id) {
        const history = this.getHistory()
        return history.find(item => item.id === id) || null
    }

    // 删除单条对话
    deleteConversation(id) {
        const history = this.getHistory()
        const filtered = history.filter(item => item.id !== id)
        localStorage.setItem(this.storageKey, JSON.stringify(filtered))
        return true
    }

    // 清空所有历史
    clearHistory() {
        localStorage.removeItem(this.storageKey)
        return true
    }

    // 更新对话（用于追加流式内容）
    updateConversation(id, updates) {
        const history = this.getHistory()
        const index = history.findIndex(item => item.id === id)
        if (index !== -1) {
            history[index] = {
                ...history[index],
                ...updates,
                updatedAt: new Date().toISOString()
            }
            localStorage.setItem(this.storageKey, JSON.stringify(history))
            return true
        }
        return false
    }

    // 导出历史记录
    exportHistory() {
        const history = this.getHistory()
        const dataStr = JSON.stringify(history, null, 2)
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `chat_history_${new Date().toISOString().slice(0, 19)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    // 导入历史记录
    importHistory(jsonData) {
        try {
            const history = JSON.parse(jsonData)
            if (Array.isArray(history)) {
                localStorage.setItem(this.storageKey, JSON.stringify(history))
                return true
            }
            return false
        } catch (error) {
            console.error('导入失败:', error)
            return false
        }
    }

    // 获取历史记录统计
    getStats() {
        const history = this.getHistory()
        const total = history.length
        const lastWeek = history.filter(item => {
            const date = new Date(item.createdAt || item.timestamp)
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            return date > weekAgo
        }).length

        return {
            total,
            lastWeek,
            oldest: history[history.length - 1]?.createdAt || null,
            newest: history[0]?.createdAt || null
        }
    }
}

// 创建单例实例
const historyService = new HistoryService()

export default historyService