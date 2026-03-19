import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface NewsItem {
  title: string
  source: string
  date: string
  url: string
  snippet: string
}

async function searchNews(keyword: string, type: 'industry' | 'stock' = 'stock', limit: number = 10): Promise<NewsItem[]> {
  try {
    const zai = await ZAI.create()

    let searchQuery: string
    if (type === 'industry') {
      searchQuery = keyword + ' 最新消息 资讯'
    } else {
      searchQuery = keyword + ' 股票 最新消息 新闻'
    }

    console.log('Search news keyword: ' + searchQuery)

    const results = await zai.functions.invoke('web_search', {
      query: searchQuery,
      num: limit
    })

    if (!Array.isArray(results)) {
      console.log('Search result is not array:', typeof results, results)
      return []
    }

    console.log('Found ' + results.length + ' results')

    return results.map((item: any) => ({
      title: item.name || item.title || 'Unknown',
      source: item.host_name || item.source || 'Unknown',
      date: item.date || new Date().toISOString().split('T')[0],
      url: item.url || '',
      snippet: item.snippet || item.summary || ''
    })).filter((item: NewsItem) => item.title !== 'Unknown' && item.url)
  } catch (error) {
    console.error('Search news failed:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword')
    const type = (searchParams.get('type') || 'stock') as 'industry' | 'stock'
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!keyword) {
      return NextResponse.json({
        success: false,
        error: 'Please provide keyword'
      }, { status: 400 })
    }

    console.log('Search news: ' + keyword + ', type: ' + type)

    const news = await searchNews(keyword, type, limit)

    if (news.length === 0) {
      return NextResponse.json({
        success: true,
        news: [],
        keyword,
        count: 0,
        message: 'No news found, try other keywords'
      })
    }

    return NextResponse.json({
      success: true,
      news,
      keyword,
      count: news.length
    })

  } catch (error: any) {
    console.error('Get news failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Get news failed',
      news: []
    }, { status: 500 })
  }
}