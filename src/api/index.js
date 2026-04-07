// frontend-vue/src/api/index.js
import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000  // 30秒超时，异步任务不需要等太久
})

export const kgApi = {
    getGraphData(limit = 50) {
        return api.get('/graph', { params: { limit } })
    },

    getSchema() {
        return api.get('/schema')
    },

    // 方式1：普通同步请求（带缓存）
    askQuestion(question) {
        return api.post('/ask', { question })
    },

    // 方式2：流式请求（方案三）
    async askQuestionStream(question, onChunk, onComplete, onError) {
        try {
            const response = await fetch('/api/ask/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            })

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop()

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (data.type === 'chunk') {
                                onChunk && onChunk(data.content)
                            } else if (data.type === 'end') {
                                onComplete && onComplete(data.full_answer, data.cypher)
                            } else if (data.type === 'error') {
                                onError && onError(data.message)
                            } else if (data.type === 'cypher') {
                                console.log('生成的Cypher:', data.cypher)
                            }
                        } catch (e) {
                            console.error('解析SSE数据失败:', e)
                        }
                    }
                }
            }
        } catch (error) {
            onError && onError(error.message)
        }
    },

    // 方式3：异步任务请求（方案五）
    async askQuestionAsync(question, onProgress, onComplete, onError) {
        try {
            // 1. 创建任务
            const createRes = await api.post('/ask/async', { question })
            const taskId = createRes.data.task_id

            // 2. 轮询结果
            const pollInterval = 2000  // 2秒轮询一次
            const maxAttempts = 90  // 最多3分钟
            let attempts = 0

            const poll = setInterval(async () => {
                attempts++

                try {
                    const resultRes = await api.get(`/ask/result/${taskId}`)
                    const status = resultRes.data.status

                    if (status === 'completed') {
                        clearInterval(poll)
                        onComplete && onComplete(resultRes.data.answer, resultRes.data.cypher)
                    } else if (status === 'failed') {
                        clearInterval(poll)
                        onError && onError(resultRes.data.error || '任务失败')
                    } else if (status === 'timeout') {
                        clearInterval(poll)
                        onError && onError('任务执行超时')
                    } else {
                        // 获取进度
                        const progressRes = await api.get(`/ask/progress/${taskId}`)
                        if (progressRes.data.steps && onProgress) {
                            const lastStep = progressRes.data.steps[progressRes.data.steps.length - 1]
                            onProgress(lastStep?.name || '处理中', progressRes.data.steps)
                        }
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(poll)
                        onError && onError('请求超时')
                    }
                } catch (err) {
                    console.error('轮询失败:', err)
                }
            }, pollInterval)

            return taskId
        } catch (error) {
            onError && onError(error.message)
        }
    },

    // 执行Cypher查询
    executeQuery(cypher) {
        return api.post('/query', { cypher })
    }


}

export default kgApi