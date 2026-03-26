#!/usr/bin/env python
"""
戴维斯双击评分运行脚本
"""

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from industry_scorer import DavisScorer


async def main():
    try:
        scorer = DavisScorer()
        scores = await scorer.score_all_industries()
        result = {
            'success': True,
            'scores': scores,
            'message': f'成功评分 {len(scores)} 个行业',
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())