import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { warmupBackend } from './lib/api'

// 首屏静默预热后端 (打消 FaaS 冷启动带来的第一次登录/拉数据超时)。
// 不阻塞渲染、错误全部吞掉。
warmupBackend()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
