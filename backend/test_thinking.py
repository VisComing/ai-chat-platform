"""
测试百炼 API 的 enable_thinking 参数和 reasoning_content 响应
"""
import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

# 百炼 API 配置
API_KEY = os.environ.get("BAILIAN_API_KEY", "")
BASE_URL = os.environ.get("BAILIAN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")


async def test_bailian_streaming():
    """测试流式响应中的 reasoning_content"""

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    # 测试请求：启用深度思考
    payload = {
        "model": "qwen3.5-plus",
        "messages": [
            {"role": "user", "content": "请解释什么是递归，并举一个例子"}
        ],
        "stream": True,
        "enable_thinking": True,  # 关键参数
        "max_tokens": 1024,
    }

    print("=" * 60)
    print("测试百炼 API 流式响应")
    print("=" * 60)
    print(f"请求参数: enable_thinking = {payload['enable_thinking']}")
    print()

    client = httpx.AsyncClient(timeout=60.0)

    try:
        response = await client.post(
            f"{BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )

        print(f"HTTP 状态码: {response.status_code}")
        print()

        if response.status_code != 200:
            print(f"错误响应: {response.text}")
            return

        # 解析 SSE 流
        reasoning_content_parts = []
        content_parts = []

        for line in response.iter_lines():
            if not line:
                continue

            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    break

                try:
                    data = json.loads(data_str)
                    choices = data.get("choices", [])

                    if choices:
                        delta = choices[0].get("delta", {})

                        # 检查 delta 中的所有字段
                        print(f"delta keys: {list(delta.keys())}")

                        # 关键：检查 reasoning_content
                        if "reasoning_content" in delta:
                            rc = delta.get("reasoning_content")
                            if rc:  # 可能是 None
                                reasoning_content_parts.append(rc)
                                print(f"  reasoning_content: {rc[:50]}..." if len(rc) > 50 else f"  reasoning_content: {rc}")

                        # 检查普通 content
                        if "content" in delta:
                            c = delta.get("content")
                            if c:  # 可能是 None
                                content_parts.append(c)

                except json.JSONDecodeError as e:
                    print(f"JSON 解析错误: {e}")

        print()
        print("=" * 60)
        print("结果汇总")
        print("=" * 60)
        print(f"reasoning_content 总长度: {len(''.join(reasoning_content_parts))} 字符")
        print(f"content 总长度: {len(''.join(content_parts))} 字符")

        if reasoning_content_parts:
            print()
            print("思考内容:")
            print("-" * 40)
            print(''.join(reasoning_content_parts)[:500])
        else:
            print()
            print("⚠️ 未收到 reasoning_content！")
            print("可能原因:")
            print("  1. enable_thinking 参数未被正确处理")
            print("  2. 模型在简单问题上不产生思考内容")
            print("  3. API 返回格式变化")

    finally:
        await client.aclose()


async def test_langchain_streaming():
    """测试 LangChain 如何处理 reasoning_content"""

    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage

    print()
    print("=" * 60)
    print("测试 LangChain 流式处理")
    print("=" * 60)

    llm = ChatOpenAI(
        model="qwen3.5-plus",
        openai_api_key=API_KEY,
        openai_api_base=BASE_URL,
        extra_body={"enable_thinking": True},  # 通过 extra_body 传递
        max_tokens=1024,
    )

    reasoning_from_kwargs = []
    content_parts = []

    async for chunk in llm.astream([HumanMessage(content="请解释什么是递归")]):
        # 检查 content
        if chunk.content:
            content_parts.append(chunk.content)

        # 检查 additional_kwargs 中的 reasoning_content
        if hasattr(chunk, "additional_kwargs"):
            rc = chunk.additional_kwargs.get("reasoning_content", "")
            if rc:
                reasoning_from_kwargs.append(rc)
                print(f"LangChain additional_kwargs.reasoning_content: {rc[:50]}..." if len(rc) > 50 else f"LangChain additional_kwargs.reasoning_content: {rc}")

    print()
    print(f"LangChain reasoning_content 总长度: {len(''.join(reasoning_from_kwargs))} 字符")
    print(f"LangChain content 总长度: {len(''.join(content_parts))} 字符")

    if not reasoning_from_kwargs:
        print()
        print("⚠️ LangChain 未从 additional_kwargs 提取 reasoning_content")
        print("需要检查 LangChain 如何处理 delta 中的非标准字段")


if __name__ == "__main__":
    # 先测试直接 API 调用
    asyncio.run(test_bailian_streaming())

    # 再测试 LangChain
    asyncio.run(test_langchain_streaming())