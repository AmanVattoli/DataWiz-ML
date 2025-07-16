import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getCollection } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Check database for file
    const files = await getCollection('uploaded_files')
    const fileRecord = await files.findOne({ 
      fileId, 
      userId: session.user.email 
    })

    return NextResponse.json({
      fileId,
      exists: !!fileRecord,
      contentSize: fileRecord?.fileContent ? fileRecord.fileContent.length : 0,
      metadata: fileRecord || null
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 