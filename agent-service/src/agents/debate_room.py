from langchain_core.messages import HumanMessage
from src.agents.state import AgentState, show_agent_reasoning, show_workflow_status
from src.tools.openrouter_config import get_chat_completion
from src.utils.api_utils import agent_endpoint, log_llm_interaction
import json
import ast
import re
import logging

logger = logging.getLogger('debate_room')


def clean_json_string(text: str) -> str:
    """Remove control characters from JSON string"""
    if not text:
        return text
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)


@agent_endpoint("debate_room", "辩论室，分析多空双方观点，得出平衡的投资结论")
def debate_room_agent(state: AgentState):
    """Facilitates debate between bull and bear researchers to reach a balanced conclusion."""
    show_workflow_status("Debate Room")
    show_reasoning = state["metadata"]["show_reasoning"]
    logger.info("开始分析研究员观点并进行辩论...")

    researcher_messages = {}
    for msg in state["messages"]:
        if msg is None:
            continue
        if not hasattr(msg, 'name') or msg.name is None:
            continue
        if isinstance(msg.name, str) and msg.name.startswith("researcher_") and msg.name.endswith("_agent"):
            researcher_messages[msg.name] = msg
            logger.debug(f"收集到研究员信息: {msg.name}")

    if "researcher_bull_agent" not in researcher_messages or "researcher_bear_agent" not in researcher_messages:
        logger.error("缺少必要的研究员数据: researcher_bull_agent 或 researcher_bear_agent")
        raise ValueError("Missing required researcher_bull_agent or researcher_bear_agent messages")

    researcher_data = {}
    for name, msg in researcher_messages.items():
        if not hasattr(msg, 'content') or msg.content is None:
            logger.warning(f"研究员 {name} 的消息内容为空")
            continue
        try:
            data = json.loads(msg.content)
            logger.debug(f"成功解析 {name} 的 JSON 内容")
        except (json.JSONDecodeError, TypeError):
            try:
                data = ast.literal_eval(msg.content)
                logger.debug(f"通过 ast.literal_eval 解析 {name} 的内容")
            except (ValueError, SyntaxError, TypeError):
                logger.warning(f"无法解析 {name} 的消息内容，已跳过")
                continue
        researcher_data[name] = data

    if "researcher_bull_agent" not in researcher_data or "researcher_bear_agent" not in researcher_data:
        logger.error("无法解析必要的研究员数据")
        raise ValueError("Could not parse required researcher_bull_agent or researcher_bear_agent messages")

    bull_thesis = researcher_data["researcher_bull_agent"]
    bear_thesis = researcher_data["researcher_bear_agent"]
    logger.info(f"已获取看多观点(置信度: {bull_thesis.get('confidence', 0)})和看空观点(置信度: {bear_thesis.get('confidence', 0)})")

    bull_confidence = bull_thesis.get("confidence", 0)
    bear_confidence = bear_thesis.get("confidence", 0)

    debate_summary = []
    debate_summary.append("Bullish Arguments:")
    for point in bull_thesis.get("thesis_points", []):
        debate_summary.append(f"+ {point}")

    debate_summary.append("\nBearish Arguments:")
    for point in bear_thesis.get("thesis_points", []):
        debate_summary.append(f"- {point}")

    all_perspectives = {}
    for name, data in researcher_data.items():
        perspective = data.get("perspective", name.replace("researcher_", "").replace("_agent", ""))
        all_perspectives[perspective] = {
            "confidence": data.get("confidence", 0),
            "thesis_points": data.get("thesis_points", [])
        }

    logger.info(f"准备让 LLM 分析 {len(all_perspectives)} 个研究员的观点")

    llm_prompt = """
You are a professional financial analyst. Please analyze the following investment researcher perspectives and provide your third-party analysis:

"""
    for perspective, data in all_perspectives.items():
        llm_prompt += f"\n{perspective.upper()} Perspective (Confidence: {data['confidence']}):\n"
        for point in data["thesis_points"]:
            llm_prompt += f"- {point}\n"

    llm_prompt += """
Please provide a JSON response in the following format:
{
    "analysis": "Your detailed analysis evaluating the pros and cons of each perspective, pointing out the most convincing arguments",
    "score": 0.5,
    "reasoning": "Brief reason for your score"
}

Important: Return ONLY valid JSON, no additional text. Use English only.
"""

    llm_response = None
    llm_analysis = None
    llm_score = 0
    
    try:
        logger.info("开始调用 LLM 获取第三方分析...")
        messages = [
            {"role": "system", "content": "You are a professional financial analyst. Always respond with valid JSON only."},
            {"role": "user", "content": llm_prompt}
        ]

        llm_response = log_llm_interaction(state)(lambda: get_chat_completion(messages))()
        logger.info("LLM 返回响应完成")

        if llm_response:
            try:
                llm_response = clean_json_string(llm_response)
                
                json_start = llm_response.find('{')
                json_end = llm_response.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = llm_response[json_start:json_end]
                    llm_analysis = json.loads(json_str)
                    llm_score = float(llm_analysis.get("score", 0))
                    llm_score = max(min(llm_score, 1.0), -1.0)
                    logger.info(f"成功解析 LLM 回复，评分: {llm_score}")
                    
                    # Safe logging
                    analysis_text = llm_analysis.get("analysis", "") or ""
                    if analysis_text and len(analysis_text) > 0:
                        preview = analysis_text[:100] if len(analysis_text) > 100 else analysis_text
                        logger.debug(f"LLM 分析内容: {preview}...")
            except Exception as e:
                logger.error(f"解析 LLM 回复失败: {str(e)}")
                llm_analysis = {"analysis": "Failed to parse LLM response", "score": 0, "reasoning": "Parsing error"}
    except Exception as e:
        logger.error(f"调用 LLM 失败: {e}")
        llm_analysis = {"analysis": "LLM API call failed", "score": 0, "reasoning": "API error"}

    confidence_diff = bull_confidence - bear_confidence
    llm_weight = 0.3
    mixed_confidence_diff = (1 - llm_weight) * confidence_diff + llm_weight * llm_score

    logger.info(f"计算混合置信度差异: 原始差异={confidence_diff:.4f}, LLM评分={llm_score:.4f}, 混合差异={mixed_confidence_diff:.4f}")

    if abs(mixed_confidence_diff) < 0.1:
        final_signal = "neutral"
        reasoning = "Balanced debate with strong arguments on both sides"
        confidence = max(bull_confidence, bear_confidence)
    elif mixed_confidence_diff > 0:
        final_signal = "bullish"
        reasoning = "Bullish arguments more convincing"
        confidence = bull_confidence
    else:
        final_signal = "bearish"
        reasoning = "Bearish arguments more convincing"
        confidence = bear_confidence

    logger.info(f"最终投资信号: {final_signal}, 置信度: {confidence}")

    # Safe extraction with defaults
    llm_analysis_text = None
    llm_reasoning_text = None
    if llm_analysis and isinstance(llm_analysis, dict):
        llm_analysis_text = llm_analysis.get("analysis")
        llm_reasoning_text = llm_analysis.get("reasoning")

    message_content = {
        "signal": final_signal,
        "confidence": confidence,
        "bull_confidence": bull_confidence,
        "bear_confidence": bear_confidence,
        "confidence_diff": confidence_diff,
        "llm_score": llm_score,
        "llm_analysis": llm_analysis_text,
        "llm_reasoning": llm_reasoning_text,
        "mixed_confidence_diff": mixed_confidence_diff,
        "debate_summary": debate_summary,
        "reasoning": reasoning
    }

    message = HumanMessage(
        content=json.dumps(message_content, ensure_ascii=False),
        name="debate_room_agent",
    )

    if show_reasoning:
        show_agent_reasoning(message_content, "Debate Room")
        state["metadata"]["agent_reasoning"] = message_content

    show_workflow_status("Debate Room", "completed")
    logger.info("辩论室分析完成")
    return {
        "messages": state["messages"] + [message],
        "data": {
            **state["data"],
            "debate_analysis": message_content
        },
        "metadata": state["metadata"],
    }