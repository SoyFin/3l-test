#!/usr/bin/env python3
"""
获取A股基本面数据并更新数据库
多数据源支持：AkShare（主）+ Baostock（备用）
"""

import akshare as ak
import baostock as bs
import sqlite3
import json
import sys
import time
import re
from datetime import datetime
from typing import Optional, Dict, List, Any

DB_PATH = "/home/z/my-project/db/custom.db"

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_timestamp_ms():
    """获取毫秒精度的ISO时间戳（避免Prisma解析问题）"""
    now = datetime.now()
    # 格式化为毫秒精度，去掉微秒
    return now.strftime('%Y-%m-%dT%H:%M:%S.') + f'{now.microsecond // 1000:03d}Z'

def normalize_code(code: str) -> str:
    """标准化股票代码（去掉SZ/SH前缀）"""
    if code:
        code = re.sub(r'^(SZ|SH|sz|sh)', '', code)
    return code

def safe_float(value, default=None):
    """安全转换为浮点数"""
    if value is None or value == '' or value == '-' or value == 'False':
        return default
    try:
        if isinstance(value, str):
            value = value.strip()
            if '%' in value:
                return float(value.replace('%', '').replace(',', ''))
            if '亿' in value:
                return float(value.replace('亿', '').replace(',', '')) * 100000000
            if '万' in value:
                return float(value.replace('万', '').replace(',', '')) * 10000
            value = value.replace(',', '')
        return float(value)
    except:
        return default

def get_stock_codes_from_db() -> List[str]:
    """从数据库获取所有股票代码"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    codes = set()
    
    try:
        cursor.execute("SELECT stocks FROM WeeklyData ORDER BY weekDate DESC LIMIT 5")
        for row in cursor.fetchall():
            try:
                stocks = json.loads(row['stocks'])
                for s in stocks:
                    if s.get('code'):
                        codes.add(s['code'])
            except:
                pass
    except:
        pass
    
    try:
        cursor.execute("SELECT stocks FROM AllStocks LIMIT 1")
        row = cursor.fetchone()
        if row:
            stocks = json.loads(row['stocks'])
            for s in stocks:
                if s.get('code'):
                    codes.add(s['code'])
    except:
        pass
    
    conn.close()
    return list(codes)

# ==================== AkShare 数据源 ====================

def get_financial_data_akshare(code: str) -> Optional[Dict]:
    """使用AkShare获取财务数据"""
    pure_code = normalize_code(code)
    
    try:
        df = ak.stock_financial_abstract_ths(symbol=pure_code, indicator="按报告期")
        if df is None or df.empty:
            return None
        
        result = {}
        latest = df.iloc[0]
        
        result['roe'] = safe_float(latest.get('净资产收益率'))
        result['gross_margin'] = safe_float(latest.get('销售毛利率'))
        result['net_margin'] = safe_float(latest.get('销售净利率'))
        result['debt_ratio'] = safe_float(latest.get('资产负债率'))
        result['current_ratio'] = safe_float(latest.get('流动比率'))
        
        if len(df) >= 5:
            try:
                current_revenue = safe_float(latest.get('营业总收入'))
                prev_revenue = safe_float(df.iloc[4].get('营业总收入'))
                if current_revenue and prev_revenue and prev_revenue > 0:
                    result['revenue_growth'] = (current_revenue - prev_revenue) / prev_revenue * 100
                
                current_profit = safe_float(latest.get('净利润'))
                prev_profit = safe_float(df.iloc[4].get('净利润'))
                if current_profit and prev_profit and prev_profit > 0:
                    result['profit_growth'] = (current_profit - prev_profit) / prev_profit * 100
            except:
                pass
        
        return result
    except Exception as e:
        print(f"    AkShare获取失败: {e}")
        return None

# ==================== Baostock 数据源（备用） ====================

def get_financial_data_baostock(code: str) -> Optional[Dict]:
    """使用Baostock获取财务数据（备用）"""
    pure_code = normalize_code(code)
    
    if len(pure_code) == 5:
        pure_code = '0' + pure_code
    
    try:
        lg = bs.login()
        
        rs = bs.query_performance(code=pure_code)
        
        if rs.error_code != '0':
            bs.logout()
            return None
        
        data = rs.get_data()
        bs.logout()
        
        if data.empty:
            return None
        
        result = {}
        latest = data.iloc[0]
        
        result['roe'] = safe_float(latest.get('roe'))
        result['gross_margin'] = safe_float(latest.get('grossProfitMargin'))
        result['debt_ratio'] = safe_float(latest.get('debtToAssets'))
        
        return result
    except Exception as e:
        print(f"    Baostock获取失败: {e}")
        return None

def get_financial_data(code: str) -> Optional[Dict]:
    """获取财务数据，尝试AkShare，如果失败则尝试Baostock"""
    data = get_financial_data_akshare(code)
    if data:
        print(f"    数据来源: AkShare")
        return data
    
    print(f"    AkShare失败，尝试Baostock...")
    data = get_financial_data_baostock(code)
    if data:
        print(f"    数据来源: Baostock")
        return data
    
    print(f"    所有数据源都失败")
    return None

def calculate_tags(fundamentals: Dict) -> List[str]:
    """根据基本面数据计算标签"""
    tags = []
    
    revenue_growth = fundamentals.get('revenue_growth')
    profit_growth = fundamentals.get('profit_growth')
    
    if revenue_growth and revenue_growth > 30:
        tags.append('营收高增')
    if profit_growth and profit_growth > 30:
        tags.append('净利高增')
    
    roe = fundamentals.get('roe')
    if roe:
        if roe > 20:
            tags.append('超高ROE')
        elif roe > 15:
            tags.append('高ROE')
    
    gross_margin = fundamentals.get('gross_margin')
    if gross_margin and gross_margin > 40:
        tags.append('高毛利')
    
    return tags

def calculate_risks(fundamentals: Dict) -> List[str]:
    """计算风险标签"""
    risks = []
    
    debt_ratio = fundamentals.get('debt_ratio')
    if debt_ratio:
        if debt_ratio > 70:
            risks.append('极高负债')
        elif debt_ratio > 50:
            risks.append('高负债')
    
    return risks

def update_single_stock(code: str, cursor) -> bool:
    """更新单只股票的基本面数据"""
    try:
        pure_code = normalize_code(code)
        print(f"  处理: {code} -> {pure_code}")
        
        financial = get_financial_data(code)
        if not financial:
            print(f"    未获取到数据")
            return False
        
        tags = calculate_tags(financial)
        risks = calculate_risks(financial)
        all_tags = tags + risks
        
        cursor.execute("""
            INSERT INTO Fundamentals (code, name, industry, revenueGrowth, profitGrowth, 
                grossMargin, roe, debtRatio, pe, pb, fundHolding, northHolding, 
                goodwill, pledgeRatio, tags, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                revenueGrowth = excluded.revenueGrowth,
                profitGrowth = excluded.profitGrowth,
                grossMargin = excluded.grossMargin,
                roe = excluded.roe,
                debtRatio = excluded.debtRatio,
                tags = excluded.tags,
                updatedAt = excluded.updatedAt
        """, (
            code, code, None,
            financial.get('revenue_growth'),
            financial.get('profit_growth'),
            financial.get('gross_margin'),
            financial.get('roe'),
            financial.get('debt_ratio'),
            financial.get('pe'),
            financial.get('pb'),
            None,
            None,
            None,
            None,
            json.dumps(all_tags) if all_tags else None,
            get_timestamp_ms()
        ))
        
        print(f"    成功: ROE={financial.get('roe')}, 负债率={financial.get('debt_ratio')}")
        return True
        
    except Exception as e:
        print(f"    失败: {e}")
        return False

def update_fundamentals_batch(stock_codes: List[str] = None, limit: int = 100):
    """批量更新基本面数据"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if stock_codes:
        codes_to_process = stock_codes[:limit]
    else:
        print("正在从数据库获取股票列表...")
        codes_to_process = get_stock_codes_from_db()
        codes_to_process = codes_to_process[:limit]
    
    if not codes_to_process:
        print("未找到股票代码，请先上传数据")
        conn.close()
        return 0
    
    updated_count = 0
    failed_count = 0
    total = len(codes_to_process)
    
    print(f"开始处理 {total} 只股票...")
    print()
    
    for i, code in enumerate(codes_to_process):
        success = update_single_stock(code, cursor)
        if success:
            updated_count += 1
        else:
            failed_count += 1
        
        if (i + 1) % 10 == 0:
            print(f"\n进度: {i + 1}/{total} (成功: {updated_count}, 失败: {failed_count})\n")
        
        time.sleep(0.3)
    
    conn.commit()
    conn.close()
    
    print(f"\n" + "=" * 50)
    print(f"更新完成: 成功 {updated_count}, 失败 {failed_count}")
    return updated_count

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='获取A股基本面数据')
    parser.add_argument('--codes', nargs='+', help='指定股票代码')
    parser.add_argument('--limit', type=int, default=100, help='处理数量限制')
    parser.add_argument('--top', action='store_true', help='只处理动量榜股票')
    parser.add_argument('--all', action='store_true', help='处理数据库中所有股票')
    
    args = parser.parse_args()
    
    print("=" * 50)
    print("A股基本面数据获取工具")
    print("数据源: AkShare（主）+ Baostock（备用）")
    print("=" * 50)
    
    if args.codes:
        print(f"模式: 指定股票 ({len(args.codes)} 只)")
        print()
        update_fundamentals_batch(args.codes, len(args.codes))
    else:
        print(f"模式: 处理数据库股票 (限制: {args.limit} 只)")
        print()
        codes = None
        if args.top:
            codes = get_stock_codes_from_db()[:args.limit]
            print(f"从动量榜获取 {len(codes)} 只股票")
        update_fundamentals_batch(codes, args.limit)
    
    print("\n完成!")

if __name__ == '__main__':
    main()
