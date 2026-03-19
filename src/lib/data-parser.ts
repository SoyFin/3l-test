import * as XLSX from 'xlsx'
import { StockData } from './db'

// 格式化日期
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 从三级行业分类中提取二级行业
export function extractLevel2Industry(fullIndustry: string): string {
  // 格式：有色金属-小金属-钨 -> 取 "小金属"
  const parts = fullIndustry.split('-')
  if (parts.length >= 2) {
    return parts[1]
  }
  return fullIndustry
}

// 解析HTML格式的表格数据
export function parseHTMLTable(htmlContent: string): StockData[] {
  const stocks: StockData[] = []
  
  // 使用正则表达式提取表格数据
  const rowPattern = /<tr><td[^>]*>(.*?)<\/td><td[^>]*>(.*?)<\/td><td[^>]*>(.*?)<\/td><td[^>]*>(.*?)<\/td><\/tr>/gi
  
  // 提取表头和数据行
  const allRows = htmlContent.match(/<tr>[\s\S]*?<\/tr>/gi) || []
  
  for (let i = 1; i < allRows.length; i++) {  // 跳过表头
    const row = allRows[i]
    const cells = row.match(/<td[^>]*>(.*?)<\/td>/gi) || []
    
    if (cells.length >= 4) {
      const getText = (cell: string) => {
        return cell.replace(/<[^>]*>/g, '').trim().replace(/^\t/, '')
      }
      
      const code = getText(cells[0])
      const name = getText(cells[1])
      const changeStr = getText(cells[2])
      const industry = getText(cells[3])
      
      // 解析涨跌幅
      const change = parseFloat(changeStr)
      
      if (code && name && !isNaN(change) && industry) {
        stocks.push({
          code: normalizeCode(code),
          name,
          change,
          industry,
          industryLevel2: extractLevel2Industry(industry)
        })
      }
    }
  }
  
  return stocks
}

// 解析Excel文件
export async function parseExcelFile(buffer: Buffer, filename: string): Promise<StockData[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  
  // 检测数据格式 - 全A数据
  if (filename.includes('全A') || data[0]?.['二级行业'] || data[0]?.['所属同花顺行业'] || data[0]?.['同花顺行业']) {
    // 全A数据格式 - 支持三级行业分列
    return data.map(row => {
      // 尝试获取行业字段（可能是三级行业或二级行业）
      const industryField = String(row['所属同花顺行业'] || row['同花顺行业'] || row['行业'] || row['二级行业'] || row['industry'] || '')
      
      // 如果是三级行业格式（包含"-"），则提取二级行业
      const industryLevel2 = industryField.includes('-') 
        ? extractLevel2Industry(industryField) 
        : industryField
      
      return {
        code: normalizeCode(String(row['代码'] || row['code'] || '')),
        name: String(row['名称'] || row['name'] || ''),
        change: 0,
        industry: industryField,
        industryLevel2
      }
    })
  } else {
    // 周度数据格式
    return data.map(row => {
      const keys = Object.keys(row)
      const codeKey = keys.find(k => k.includes('股票代码') || k.toLowerCase().includes('code')) || keys[0]
      const nameKey = keys.find(k => k.includes('股票简称') || k.toLowerCase().includes('name')) || keys[1]
      const changeKey = keys.find(k => k.includes('涨跌幅') || k.toLowerCase().includes('change')) || keys[2]
      const industryKey = keys.find(k => k.includes('行业') || k.toLowerCase().includes('industry')) || keys[3]
      
      const industry = String(row[industryKey] || '')
      return {
        code: normalizeCode(String(row[codeKey] || '')),
        name: String(row[nameKey] || ''),
        change: parseFloat(String(row[changeKey] || 0)),
        industry,
        industryLevel2: extractLevel2Industry(industry)
      }
    }).filter(s => s.code && s.name)
  }
}

// 解析CSV文件
export function parseCSV(content: string): StockData[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const stocks: StockData[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length >= 4) {
      const codeIdx = headers.findIndex(h => h.includes('代码') || h.toLowerCase().includes('code'))
      const nameIdx = headers.findIndex(h => h.includes('名称') || h.toLowerCase().includes('name'))
      const changeIdx = headers.findIndex(h => h.includes('涨跌幅') || h.toLowerCase().includes('change'))
      const industryIdx = headers.findIndex(h => h.includes('行业') || h.toLowerCase().includes('industry'))
      
      const industry = values[industryIdx >= 0 ? industryIdx : 3]
      stocks.push({
        code: normalizeCode(values[codeIdx >= 0 ? codeIdx : 0]),
        name: values[nameIdx >= 0 ? nameIdx : 1],
        change: parseFloat(values[changeIdx >= 0 ? changeIdx : 2]) || 0,
        industry,
        industryLevel2: extractLevel2Industry(industry)
      })
    }
  }
  
  return stocks
}

// 统一股票代码格式
export function normalizeCode(code: string): string {
  if (!code) return ''
  code = code.trim().toUpperCase()
  
  // 如果已经是标准格式，直接返回
  if (code.match(/^(SH|SZ|BJ)\d{6}$/)) {
    return code
  }
  
  // 提取数字部分
  const digits = code.replace(/\D/g, '')
  if (digits.length !== 6) return code
  
  // 根据数字开头判断市场
  if (digits.startsWith('6')) {
    return `SH${digits}`
  } else if (digits.startsWith('0') || digits.startsWith('3')) {
    return `SZ${digits}`
  } else if (digits.startsWith('8') || digits.startsWith('4')) {
    return `BJ${digits}`
  }
  
  return code
}

// 检测文件类型并解析
export async function parseFile(buffer: Buffer, filename: string): Promise<StockData[]> {
  const content = buffer.toString('utf-8')
  
  // 检测是否为HTML格式
  if (content.includes('<!DOCTYPE') || content.includes('<html') || content.includes('<table')) {
    console.log('Detected HTML format')
    return parseHTMLTable(content)
  }
  
  // 检测是否为CSV格式
  if (filename.toLowerCase().endsWith('.csv') || (content.includes(',') && !content.includes('PK'))) {
    console.log('Detected CSV format')
    return parseCSV(content)
  }
  
  // 默认尝试Excel格式
  console.log('Trying Excel format')
  return parseExcelFile(buffer, filename)
}

// 解析全A数据
export async function parseAllStocksFile(buffer: Buffer, filename: string): Promise<Map<string, string>> {
  const stocks = await parseFile(buffer, filename)
  const industryMap = new Map<string, string>()
  
  for (const stock of stocks) {
    industryMap.set(stock.code, stock.industryLevel2)
  }
  
  return industryMap
}
