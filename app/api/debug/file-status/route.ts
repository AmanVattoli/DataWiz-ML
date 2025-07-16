import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Check database for file
    const files = await getCollection('uploaded_files')
    const fileRecord = await files.findOne({ 
      fileId
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