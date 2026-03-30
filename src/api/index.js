import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000
})

export const kgApi = {
    // 获取图谱数据
    getGraphData(limit = 50) {
        return api.get('/graph', { params: { limit } })
    },

    // 获取schema
    getSchema() {
        return api.get('/schema')
    },

    // 智能问答
    askQuestion(question) {
        return api.post('/ask', { question })
    }
}

export default kgApi