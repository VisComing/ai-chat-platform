'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const { login, register, isLoading } = useAuthStore()

  const [isRegister, setIsRegister] = useState(false)
  const [account, setAccount] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Test mode - prefill test user
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'
  const testUser = process.env.NEXT_PUBLIC_TEST_USER || 'testuser'
  const testPass = process.env.NEXT_PUBLIC_TEST_PASS || 'testpass123'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      if (isRegister) {
        if (!email) {
          setError('请输入邮箱')
          return
        }
        await register(email, account, password)
      } else {
        await login(account, password)
      }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleTestLogin = async () => {
    setError('')
    try {
      await login(testUser, testPass)
      router.push('/')
    } catch (err) {
      setError('测试用户登录失败')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI 对话平台
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {isRegister ? '创建新账户' : '登录您的账户'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="your@email.com"
                required={isRegister}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="输入用户名"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="输入密码"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? '处理中...' : (isRegister ? '注册' : '登录')}
          </Button>
        </form>

        {/* Test mode quick login */}
        {isTestMode && (
          <div className="mt-4">
            <button
              onClick={handleTestLogin}
              className="w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              disabled={isLoading}
            >
              快速登录测试用户
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              测试账户: {testUser} / {testPass}
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
            }}
            className="text-blue-500 hover:text-blue-600 text-sm"
          >
            {isRegister ? '已有账户？立即登录' : '没有账户？立即注册'}
          </button>
        </div>
      </div>
    </div>
  )
}