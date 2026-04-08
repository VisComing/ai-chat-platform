import type { Metadata } from 'next'
import './globals.css'
import { ToastContainer } from '@/components/ui'

export const metadata: Metadata = {
  title: 'AI对话平台',
  description: '智能对话交互平台，支持多模态输入输出、Agent任务执行、知识库问答',
  keywords: ['AI', 'Chat', '对话', 'GPT', '智能助手'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-secondary-900">
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}
