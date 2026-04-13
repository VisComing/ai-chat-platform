'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { traceService, Trace, TraceDetail } from '@/services/traceService'
import { useAuthStore, checkAuth, autoLoginTestUser } from '@/stores/authStore'

export default function TracesPage() {
  const router = useRouter()
  const [traces, setTraces] = useState<Trace[]>([])
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionIdFilter, setSessionIdFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isInitializing, setIsInitializing] = useState(true)

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Initialize auth
  useEffect(() => {
    const init = async () => {
      try {
        const isAuthed = await checkAuth()

        if (!isAuthed) {
          const autoLoginSuccess = await autoLoginTestUser()
          if (!autoLoginSuccess) {
            router.push('/login')
            return
          }
        }

        setIsInitializing(false)
      } catch (error) {
        console.error('[Traces] Init failed:', error)
        router.push('/login')
      }
    }
    init()
  }, [router])

  useEffect(() => {
    if (isAuthenticated && !isInitializing) {
      loadTraces()
    }
  }, [isAuthenticated, isInitializing, page, sessionIdFilter])

  const loadTraces = async () => {
    setLoading(true)
    try {
      const params: { page: number; limit: number; session_id?: string } = { page, limit: 20 }
      if (sessionIdFilter) {
        params.session_id = sessionIdFilter
      }
      const result = await traceService.list(params)
      setTraces(result.data)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to load traces:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTraceDetail = async (traceId: string) => {
    try {
      const detail = await traceService.get(traceId)
      setSelectedTrace(detail)
    } catch (error) {
      console.error('Failed to load trace detail:', error)
    }
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">请先登录查看 Trace 记录</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧：Trace 列表 */}
      <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold mb-4">模型调用追踪</h1>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="按 Session ID 筛选"
              value={sessionIdFilter}
              onChange={(e) => setSessionIdFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={loadTraces}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
            >
              查询
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-center text-gray-500">加载中...</div>
        ) : traces.length === 0 ? (
          <div className="p-4 text-center text-gray-500">暂无 Trace 记录</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {traces.map((trace) => (
              <div
                key={trace.id}
                onClick={() => loadTraceDetail(trace.id)}
                className={`p-4 cursor-pointer hover:bg-blue-50 ${
                  selectedTrace?.id === trace.id ? 'bg-blue-100' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-900">{trace.model}</span>
                  <span className="text-xs text-gray-500">{trace.api_provider}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{trace.duration_ms}ms</span>
                  <span>
                    {trace.token_input ?? '-'} / {trace.token_output ?? '-'} tokens
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {new Date(trace.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {total > 20 && (
          <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 text-sm disabled:text-gray-400"
            >
              上一页
            </button>
            <span className="text-sm text-gray-600">
              第 {page} 页，共 {total} 条
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * 20 >= total}
              className="px-3 py-1 text-sm disabled:text-gray-400"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* 右侧：Trace 详情 */}
      <div className="w-1/2 overflow-y-auto bg-white">
        {selectedTrace ? (
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4">Trace 详情</h2>

            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <span className="text-xs text-gray-500">模型</span>
                <p className="text-sm font-medium">{selectedTrace.model}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Provider</span>
                <p className="text-sm font-medium">{selectedTrace.api_provider}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">耗时</span>
                <p className="text-sm font-medium">{selectedTrace.duration_ms}ms</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Token</span>
                <p className="text-sm font-medium">
                  {selectedTrace.token_input ?? '-'} 输入 / {selectedTrace.token_output ?? '-'} 输出
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Session</span>
                <p className="text-sm font-medium truncate">{selectedTrace.session_id}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Message</span>
                <p className="text-sm font-medium truncate">{selectedTrace.message_id}</p>
              </div>
            </div>

            {/* 请求消息 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2">请求消息</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedTrace.request_messages?.map((msg, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs text-blue-600 font-medium">{msg.role}</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 响应内容 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2">响应内容</h3>
              <div className="p-3 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{selectedTrace.response_content || '(空)'}</p>
              </div>
            </div>

            {/* 错误信息 */}
            {selectedTrace.status === 'error' && selectedTrace.error_message && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 text-red-600">错误信息</h3>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700">{selectedTrace.error_message}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            点击左侧 Trace 查看详情
          </div>
        )}
      </div>
    </div>
  )
}