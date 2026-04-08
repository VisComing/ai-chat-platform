"""
Huey Application Configuration
异步任务队列配置

开发环境使用 immediate=True 模式，任务同步立即执行
生产环境可切换为 Redis 后端或修复 SQLite 兼容性
"""
from huey import Huey
from app.core.config import settings

# 创建 Huey 实例
# 使用 immediate=True 模式，任务会立即同步执行，无需启动 worker
# 这解决了 SqliteHuey 与 Python 3.12 的兼容性问题
huey = Huey(
    name='research_worker',
    immediate=True,  # 开发模式：任务立即同步执行
)