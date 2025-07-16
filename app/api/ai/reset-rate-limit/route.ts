import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // No rate limits to reset - Redis removed for simpler deployment

    return NextResponse.json({
      message: 'Rate limits not applicable - Redis caching removed'
    })

  } catch (error) {
    console.error('Rate limit reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 