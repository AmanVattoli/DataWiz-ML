import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {

    const body = await request.json()
    const { fileId } = body

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // No cleaned data cache to clear - Redis removed for simpler deployment

    return NextResponse.json({
      message: 'Cleaned data cache not applicable - Redis caching removed',
      fileId
    })

  } catch (error) {
    console.error('Clear cleaned data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 