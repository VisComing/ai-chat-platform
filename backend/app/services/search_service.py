"""
Alibaba Cloud UnifiedSearch Service (IQS - Information Query Service)
封装阿里云通用搜索 API - 新版 UnifiedSearch 接口
"""
import httpx
import json
import logging
from typing import List, Dict, Any, Optional
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class SearchResult:
    """搜索结果数据结构"""
    def __init__(
        self,
        title: str,
        link: str,
        snippet: str,
        published_time: Optional[str] = None,
        main_text: Optional[str] = None,
        rerank_score: Optional[float] = None,
    ):
        self.title = title
        self.link = link
        self.snippet = snippet
        self.published_time = published_time
        self.main_text = main_text
        self.rerank_score = rerank_score
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "link": self.link,
            "snippet": self.snippet,
            "published_time": self.published_time,
            "main_text": self.main_text,
            "rerank_score": self.rerank_score,
        }


class SearchService:
    """阿里云通用搜索服务 - UnifiedSearch API"""
    
    # 引擎类型
    ENGINE_GENERIC = "Generic"  # 标准版，返回10条结果
    ENGINE_GENERIC_ADVANCED = "GenericAdvanced"  # 增强版，返回约50条结果（收费）
    ENGINE_LITE_ADVANCED = "LiteAdvanced"  # 极速版，支持1-50条结果
    
    # 时间范围
    TIME_ONE_DAY = "OneDay"
    TIME_ONE_WEEK = "OneWeek"
    TIME_ONE_MONTH = "OneMonth"
    TIME_ONE_YEAR = "OneYear"
    TIME_NO_LIMIT = "NoLimit"
    
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.alibaba_search_api_key
        self.base_url = self.settings.alibaba_search_base_url
        self.endpoint = self.settings.alibaba_search_endpoint
        self.timeout = self.settings.alibaba_search_timeout
        self.max_results = self.settings.search_max_results
    
    async def search(
        self,
        query: str,
        engine_type: Optional[str] = None,
        time_range: Optional[str] = None,
        top_k: Optional[int] = None,
        contents: Optional[Dict[str, bool]] = None,
    ) -> List[SearchResult]:
        """
        执行搜索 - 使用 UnifiedSearch API
        
        Args:
            query: 搜索关键词（1-500字符，建议≤30字符）
            engine_type: 引擎类型
                - Generic: 标准版，返回10条结果
                - GenericAdvanced: 增强版，返回约50条结果（收费）
                - LiteAdvanced: 极速版，支持1-50条结果
            time_range: 时间范围
                - OneDay/OneWeek/OneMonth/OneYear/NoLimit
            top_k: 返回结果数量（仅 LiteAdvanced 支持）
            contents: 返回内容控制
                - mainText: 是否返回长正文（≤3000字符）
                - summary: 是否返回增强摘要（收费）
                - rerankScore: 是否返回重排序得分
        
        Returns:
            搜索结果列表
        
        Raises:
            Exception: 搜索失败时抛出异常
        """
        if not self.api_key:
            logger.warning("Search API key not configured, skipping search")
            return []
        
        # 默认参数
        engine_type = engine_type or self.ENGINE_GENERIC
        time_range = time_range or self.TIME_NO_LIMIT
        
        # 构建请求体
        body = {
            "query": query,
            "engineType": engine_type,
            "timeRange": time_range,
        }
        
        # LiteAdvanced 支持自定义结果数量
        if engine_type == self.ENGINE_LITE_ADVANCED and top_k:
            body["topK"] = min(top_k, 50)  # 最大50条
        
        # 返回内容控制
        if contents:
            body["contents"] = contents
        else:
            # 默认返回重排序得分
            body["contents"] = {
                "rerankScore": True,
            }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        url = f"{self.base_url}{self.endpoint}"
        
        logger.info(f"Search request: query='{query}', engine={engine_type}")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=body
                )
                
                logger.info(f"Search response: status={response.status_code}")
                
                if response.status_code != 200:
                    error_text = response.text
                    logger.error(f"Search API error: {response.status_code} - {error_text}")
                    # 返回空结果，让 Agent 降级处理
                    return []
                
                data = response.json()
                
                # 解析搜索结果 - 新格式使用 pageItems
                results = []
                page_items = data.get("pageItems", [])
                
                for item in page_items:
                    result = SearchResult(
                        title=item.get("title", ""),
                        link=item.get("link", ""),
                        snippet=item.get("snippet", ""),
                        published_time=item.get("publishedTime"),
                        main_text=item.get("mainText"),
                        rerank_score=item.get("rerankScore"),
                    )
                    results.append(result)
                
                # 按重排序得分排序（如果有）
                if results and results[0].rerank_score is not None:
                    results.sort(key=lambda x: x.rerank_score or 0, reverse=True)
                
                # 限制结果数量
                if top_k and len(results) > top_k:
                    results = results[:top_k]
                
                # 记录使用情况
                search_info = data.get("searchInformation", {})
                search_time = search_info.get("searchTime", 0)
                cost_credits = data.get("costCredits", {})
                
                logger.info(
                    f"Search completed: query='{query}', "
                    f"results={len(results)}, time={search_time}ms, "
                    f"credits={cost_credits}"
                )
                
                return results
                
        except httpx.TimeoutException:
            logger.error(f"Search timeout after {self.timeout}s for query: {query}")
            # 返回空结果，让 Agent 降级处理
            return []
        except httpx.ConnectError as e:
            logger.error(f"Search connection error: {e}")
            # 返回空结果，让 Agent 降级处理
            return []
        except Exception as e:
            logger.error(f"Search error: {e}")
            # 返回空结果，让 Agent 降级处理
            return []
    
    def format_results_for_llm(self, results: List[SearchResult]) -> str:
        """
        将搜索结果格式化为 LLM 可读的文本

        Args:
            results: 搜索结果列表

        Returns:
            格式化的文本
        """
        if not results:
            return "未找到相关搜索结果。"

        from datetime import datetime
        current_date = datetime.now().strftime("%Y年%m月%d日")

        formatted = [f"（搜索日期：{current_date}，请根据搜索结果的发布时间判断信息时效性）\n"]
        for i, result in enumerate(results, 1):
            # 包含发布时间（如果有），并明确标注时效性
            time_info = ""
            if result.published_time:
                time_info = f"\n发布时间: {result.published_time}"

            # 包含重排序得分（如果有）
            score_info = ""
            if result.rerank_score:
                score_info = f" [相关性: {result.rerank_score:.2f}]"

            formatted.append(
                f"[{i}] {result.title}{score_info}\n"
                f"链接: {result.link}{time_info}\n"
                f"内容摘要: {result.snippet}\n"
            )

        return "\n".join(formatted)
    
    def format_citations(self, results: List[SearchResult]) -> str:
        """
        生成引用链接列表
        
        Args:
            results: 搜索结果列表
        
        Returns:
            引用文本
        """
        if not results:
            return ""
        
        citations = []
        for i, result in enumerate(results, 1):
            citations.append(f"[{i}] [{result.title}]({result.link})")
        
        return "\n".join(citations)


# 单例实例
search_service = SearchService()