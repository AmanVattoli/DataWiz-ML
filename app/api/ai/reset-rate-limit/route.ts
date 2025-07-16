import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // No rate limits to reset - Redis removed for simpler deployment

    return NextResponse.json({
      message: 'Rate limits not applicable - Redis caching removed',
      user: session.user.email
    })

  } catch (error) {
    console.error('Rate limit reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 