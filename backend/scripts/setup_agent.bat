@echo off
echo ========================================
echo LangGraph Agent 快速部署脚本
echo ========================================
echo.

echo [1/4] 安装依赖...
pip install langgraph==0.2.28
pip install langchain==0.3.0
pip install langchain-openai==0.2.0
pip install langchain-core==0.3.0
echo.

echo [2/4] 检查环境变量...
if not exist .env (
    echo ⚠️  .env 文件不存在，正在创建...
    copy .env.example .env
    echo ✅ 已创建 .env 文件
    echo.
    echo ⚠️  请编辑 .env 文件，设置 ALIBABA_SEARCH_API_KEY
    echo.
) else (
    echo ✅ .env 文件已存在
)
echo.

echo [3/4] 验证配置...
python -c "from app.core.config import settings; print('API Key:', '已配置' if settings.alibaba_search_api_key else '未配置'); print('Search Enabled:', settings.enable_search_agent)"
echo.

echo [4/4] 运行测试...
echo 运行 Agent 测试...
python tests/test_agent.py
echo.

echo ========================================
echo 部署完成！
echo ========================================
echo.
echo 下一步：
echo 1. 确保 .env 中 ALIBABA_SEARCH_API_KEY 已设置
echo 2. 启动后端服务: uvicorn app.main:app --reload
echo 3. 测试 Agent API: POST /api/v1/chat/agent/stream
echo.
pause