# -*- coding: utf-8 -*-
"""
戴维斯双击行业评分系统 - 数据获取模块

通过akshare获取申万二级行业数据
"""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np

try:
    import akshare as ak
except ImportError:
    ak = None


class DataFetcher:
    """申万二级行业数据获取器"""

    def __init__(self, cache_dir: str = "/tmp/industry_scorer_cache"):
        """
        初始化数据获取器

        Args:
            cache_dir: 缓存目录
        """
        self.cache_dir = cache_dir
        if ak is None:
            raise ImportError("akshare未安装，请运行: pip install akshare")

    def get_industry_list(self) -> List[Dict[str, str]]:
        """
        获取申万二级行业列表

        Returns:
            行业列表 [{"code": "801010", "name": "种植业"}, ...]
        """
        try:
            # 获取申万行业分类
            df = ak.sw_index_second_info()
            if df is not None and len(df) > 0:
                # 处理列名
                columns = df.columns.tolist()
                code_col = columns[0] if len(columns) > 0 else "index_code"
                name_col = columns[1] if len(columns) > 1 else "index_name"

                industries = []
                for _, row in df.iterrows():
                    industries.append({
                        "code": str(row[code_col]),
                        "name": str(row[name_col])
                    })
                return industries
        except Exception as e:
            print(f"获取行业列表失败: {e}")

        # 返回默认行业列表
        return self._get_default_industries()

    def _get_default_industries(self) -> List[Dict[str, str]]:
        """获取默认行业列表（备用）"""
        return [
            {"code": "801020", "name": "煤炭开采"},
            {"code": "801030", "name": "石油开采"},
            {"code": "801040", "name": "油服工程"},
            {"code": "801050", "name": "炼化及贸易"},
            {"code": "801080", "name": "钢铁"},
            {"code": "801110", "name": "有色金属"},
            {"code": "801120", "name": "金属新材料"},
            {"code": "801130", "name": "基础化工"},
            {"code": "801140", "name": "塑料"},
            {"code": "801150", "name": "橡胶"},
            {"code": "801160", "name": "化纤"},
            {"code": "801200", "name": "建筑材料"},
            {"code": "801210", "name": "水泥"},
            {"code": "801230", "name": "玻璃玻纤"},
            {"code": "801250", "name": "建筑装饰"},
            {"code": "801260", "name": "房屋建设"},
            {"code": "801270", "name": "装修装饰"},
            {"code": "801280", "name": "基础建设"},
            {"code": "801300", "name": "电力设备"},
            {"code": "801310", "name": "电池"},
            {"code": "801320", "name": "光伏设备"},
            {"code": "801330", "name": "风电设备"},
            {"code": "801340", "name": "电机"},
            {"code": "801350", "name": "电网设备"},
            {"code": "801360", "name": "家电"},
            {"code": "801370", "name": "白电"},
            {"code": "801380", "name": "黑电"},
            {"code": "801390", "name": "小家电"},
            {"code": "801400", "name": "照明设备"},
            {"code": "801410", "name": "汽车"},
            {"code": "801420", "name": "乘用车"},
            {"code": "801430", "name": "商用车"},
            {"code": "801440", "name": "汽车零部件"},
            {"code": "801450", "name": "汽车服务"},
            {"code": "801460", "name": "摩托车"},
            {"code": "801500", "name": "机械设备"},
            {"code": "801510", "name": "通用设备"},
            {"code": "801520", "name": "专用设备"},
            {"code": "801530", "name": "仪器仪表"},
            {"code": "801540", "name": "运输设备"},
            {"code": "801550", "name": "工程机械"},
            {"code": "801560", "name": "自动化设备"},
            {"code": "801600", "name": "国防军工"},
            {"code": "801610", "name": "航天装备"},
            {"code": "801620", "name": "航空装备"},
            {"code": "801630", "name": "地面兵装"},
            {"code": "801640", "name": "航海装备"},
            {"code": "801700", "name": "电子"},
            {"code": "801710", "name": "半导体"},
            {"code": "801720", "name": "元件"},
            {"code": "801730", "name": "光学光电子"},
            {"code": "801740", "name": "消费电子"},
            {"code": "801750", "name": "其他电子"},
            {"code": "801760", "name": "电子化学品"},
            {"code": "801800", "name": "计算机"},
            {"code": "801810", "name": "计算机设备"},
            {"code": "801820", "name": "IT服务"},
            {"code": "801830", "name": "软件开发"},
            {"code": "801850", "name": "通信"},
            {"code": "801860", "name": "通信设备"},
            {"code": "801870", "name": "通信服务"},
            {"code": "801880", "name": "电信运营商"},
            {"code": "801900", "name": "传媒"},
            {"code": "801910", "name": "出版"},
            {"code": "801920", "name": "影视院线"},
            {"code": "801930", "name": "电视广播"},
            {"code": "801940", "name": "广告营销"},
            {"code": "801950", "name": "游戏"},
            {"code": "801960", "name": "数字媒体"},
            {"code": "801970", "name": "互联网电商"},
            {"code": "801980", "name": "教育"},
            {"code": "802000", "name": "银行"},
            {"code": "802010", "name": "国有大型银行"},
            {"code": "802020", "name": "股份制银行"},
            {"code": "802030", "name": "城商行"},
            {"code": "802040", "name": "农商行"},
            {"code": "802100", "name": "非银金融"},
            {"code": "802110", "name": "证券"},
            {"code": "802120", "name": "保险"},
            {"code": "802130", "name": "多元金融"},
            {"code": "802200", "name": "房地产"},
            {"code": "802210", "name": "房地产开发"},
            {"code": "802220", "name": "房地产服务"},
            {"code": "802300", "name": "医药生物"},
            {"code": "802310", "name": "化学制药"},
            {"code": "802320", "name": "中药"},
            {"code": "802330", "name": "生物制品"},
            {"code": "802340", "name": "医药商业"},
            {"code": "802350", "name": "医疗器械"},
            {"code": "802360", "name": "医疗服务"},
            {"code": "802400", "name": "食品饮料"},
            {"code": "802410", "name": "食品加工"},
            {"code": "802420", "name": "饮料乳品"},
            {"code": "802430", "name": "白酒"},
            {"code": "802440", "name": "非白酒"},
            {"code": "802450", "name": "调味发酵品"},
            {"code": "802500", "name": "农林牧渔"},
            {"code": "802510", "name": "种植业"},
            {"code": "802520", "name": "林业"},
            {"code": "802530", "name": "渔业"},
            {"code": "802540", "name": "饲料"},
            {"code": "802550", "name": "农产品加工"},
            {"code": "802560", "name": "养殖业"},
            {"code": "802570", "name": "动物保健"},
            {"code": "802600", "name": "公用事业"},
            {"code": "802610", "name": "电力"},
            {"code": "802620", "name": "燃气"},
            {"code": "802630", "name": "水务"},
            {"code": "802640", "name": "环保"},
            {"code": "802700", "name": "交通运输"},
            {"code": "802710", "name": "铁路公路"},
            {"code": "802720", "name": "航空机场"},
            {"code": "802730", "name": "航运港口"},
            {"code": "802740", "name": "物流"},
            {"code": "802800", "name": "商贸零售"},
            {"code": "802810", "name": "一般零售"},
            {"code": "802820", "name": "专业零售"},
            {"code": "802830", "name": "贸易"},
            {"code": "802840", "name": "互联网电商"},
            {"code": "802900", "name": "社会服务"},
            {"code": "802910", "name": "酒店餐饮"},
            {"code": "802920", "name": "旅游及景区"},
            {"code": "802930", "name": "教育"},
            {"code": "802940", "name": "专业服务"},
            {"code": "803000", "name": "美容护理"},
            {"code": "803010", "name": "个护用品"},
            {"code": "803020", "name": "化妆品"},
            {"code": "803030", "name": "医疗美容"},
            {"code": "803100", "name": "纺织服饰"},
            {"code": "803110", "name": "纺织制造"},
            {"code": "803120", "name": "服装家纺"},
            {"code": "803130", "name": "饰品"},
            {"code": "803200", "name": "轻工制造"},
            {"code": "803210", "name": "造纸"},
            {"code": "803220", "name": "包装印刷"},
            {"code": "803230", "name": "家居用品"},
            {"code": "803240", "name": "文娱用品"},
            {"code": "803250", "name": "其他轻工"},
        ]

    def get_industry_daily_data(
        self,
        industry_code: str,
        start_date: str = None,
        end_date: str = None
    ) -> pd.DataFrame:
        """
        获取行业日线数据

        Args:
            industry_code: 行业代码
            start_date: 开始日期 (YYYYMMDD)
            end_date: 结束日期 (YYYYMMDD)

        Returns:
            日线数据DataFrame
        """
        if end_date is None:
            end_date = datetime.now().strftime("%Y%m%d")
        if start_date is None:
            start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")

        try:
            df = ak.sw_index_daily(symbol=industry_code)
            if df is not None and len(df) > 0:
                # 标准化列名
                df.columns = ['date', 'open', 'high', 'low', 'close', 'volume', 'amount']
                df['date'] = pd.to_datetime(df['date'])
                df = df.sort_values('date')
                return df
        except Exception as e:
            print(f"获取行业 {industry_code} 日线数据失败: {e}")

        return pd.DataFrame()

    def get_industry_pe_data(
        self,
        industry_code: str,
        start_date: str = None,
        end_date: str = None
    ) -> pd.DataFrame:
        """
        获取行业PE数据

        Args:
            industry_code: 行业代码
            start_date: 开始日期
            end_date: 结束日期

        Returns:
            PE数据DataFrame
        """
        try:
            df = ak.sw_index_daily(symbol=industry_code)
            if df is not None and len(df) > 0:
                # 尝试获取PE数据
                try:
                    pe_df = ak.stock_a_lg_indicator(symbol=f"sh{industry_code}")
                    if pe_df is not None and len(pe_df) > 0:
                        return pe_df
                except:
                    pass
        except Exception as e:
            print(f"获取行业 {industry_code} PE数据失败: {e}")

        return pd.DataFrame()

    def get_industry_capital_flow(
        self,
        industry_name: str,
        days: int = 20
    ) -> Dict[str, Any]:
        """
        获取行业资金流向

        Args:
            industry_name: 行业名称
            days: 回看天数

        Returns:
            资金流向数据
        """
        try:
            # 获取行业资金流向
            df = ak.stock_sector_fund_flow_rank(indicator="今日")
            if df is not None and len(df) > 0:
                # 查找匹配行业
                for _, row in df.iterrows():
                    if industry_name in str(row.iloc[0]) or str(row.iloc[0]) in industry_name:
                        return {
                            "industry": industry_name,
                            "main_inflow": float(row.get("主力净流入-净额", 0)),
                            "main_ratio": float(row.get("主力净流入-净占比", 0)),
                            "retail_inflow": float(row.get("散户净流入-净额", 0)),
                            "retail_ratio": float(row.get("散户净流入-净占比", 0)),
                        }
        except Exception as e:
            print(f"获取行业 {industry_name} 资金流向失败: {e}")

        return {
            "industry": industry_name,
            "main_inflow": 0,
            "main_ratio": 0,
            "retail_inflow": 0,
            "retail_ratio": 0,
        }

    def get_north_money_flow(
        self,
        days: int = 20
    ) -> pd.DataFrame:
        """
        获取北向资金流向

        Args:
            days: 回看天数

        Returns:
            北向资金数据
        """
        try:
            df = ak.stock_hsgt_north_net_flow_in_em()
            if df is not None and len(df) > 0:
                df = df.tail(days)
                return df
        except Exception as e:
            print(f"获取北向资金数据失败: {e}")

        return pd.DataFrame()

    def get_industry_north_holding(
        self,
        industry_name: str
    ) -> Dict[str, Any]:
        """
        获取行业北向资金持仓

        Args:
            industry_name: 行业名称

        Returns:
            北向持仓数据
        """
        try:
            # 获取北向持股行业分布
            df = ak.stock_hsgt_hold_stock_em(market="北向")
            if df is not None and len(df) > 0:
                # 筛选行业
                industry_stocks = df[df['行业'] == industry_name]
                if len(industry_stocks) > 0:
                    total_holding = industry_stocks['持股数量'].sum()
                    total_value = industry_stocks['持股市值'].sum() if '持股市值' in industry_stocks.columns else 0
                    return {
                        "industry": industry_name,
                        "holding_shares": total_holding,
                        "holding_value": total_value,
                        "stock_count": len(industry_stocks),
                    }
        except Exception as e:
            print(f"获取行业 {industry_name} 北向持仓失败: {e}")

        return {
            "industry": industry_name,
            "holding_shares": 0,
            "holding_value": 0,
            "stock_count": 0,
        }

    def get_market_index(
        self,
        index_code: str = "000001",
        days: int = 60
    ) -> pd.DataFrame:
        """
        获取市场指数数据

        Args:
            index_code: 指数代码
            days: 回看天数

        Returns:
            指数数据
        """
        try:
            df = ak.stock_zh_a_hist(symbol=index_code, period="daily", adjust="qfq")
            if df is not None and len(df) > 0:
                df = df.tail(days)
                df.columns = ['date', 'open', 'close', 'high', 'low', 'volume', 'amount', 'amplitude', 'pct_change', 'change', 'turnover']
                return df
        except Exception as e:
            print(f"获取指数 {index_code} 数据失败: {e}")

        return pd.DataFrame()

    def get_all_industries_data(
        self,
        include_history: bool = True
    ) -> Dict[str, Any]:
        """
        获取所有行业数据

        Args:
            include_history: 是否包含历史数据

        Returns:
            所有行业数据
        """
        industries = self.get_industry_list()
        result = {
            "industries": industries,
            "daily_data": {},
            "capital_flow": {},
            "timestamp": datetime.now().isoformat(),
        }

        for industry in industries[:30]:  # 限制数量避免超时
            code = industry["code"]
            name = industry["name"]

            try:
                # 获取日线数据
                if include_history:
                    daily = self.get_industry_daily_data(code)
                    if len(daily) > 0:
                        result["daily_data"][name] = daily.to_dict("records")[-60:]  # 最近60天

                # 获取资金流向
                flow = self.get_industry_capital_flow(name)
                result["capital_flow"][name] = flow

            except Exception as e:
                print(f"获取行业 {name} 数据失败: {e}")

        return result
