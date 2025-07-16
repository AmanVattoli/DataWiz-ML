import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import crypto from 'crypto'

// Helper function to chunk large strings
function chunkString(str: string, chunkSize: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize))
  }
  return chunks
}

// Helper function to reconstruct string from chunks
function reconstructFromChunks(chunks: string[]): string {
  return chunks.join('')
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for basic tracking (optional)
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })
    }



    // Read file content
    const fileContent = await file.text()
    const lines = fileContent.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have at least a header and one data row' }, { status: 400 })
    }

    // Parse CSV header
    const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''))
    const rowCount = lines.length - 1

    // Generate file ID
    const fileId = crypto.randomUUID()
    const fileHash = crypto.createHash('md5').update(fileContent).digest('hex')

    // Parse all data rows
    const allDataRows = lines.slice(1) // All rows except header
    const allData = allDataRows.map(row => {
      const values = row.split(',').map(val => val.trim().replace(/"/g, ''))
      const rowObj: Record<string, string> = {}
      header.forEach((col, idx) => {
        rowObj[col] = values[idx] || ''
      })
      return rowObj
    })

    // Check if file content would exceed MongoDB document size limit (16MB)
    const estimatedSize = JSON.stringify({ fileContent, allData }).length
    const isLargeFile = estimatedSize > 15 * 1024 * 1024 // 15MB threshold for safety

    // Store file data in MongoDB
    const files = await getCollection('uploaded_files')
    
    if (isLargeFile) {
      // For large files, store metadata and sample data only
      const sampleData = allData.slice(0, 1000) // Store first 1000 rows as sample
      
      const fileRecord = {
        fileId,
        fileName: file.name,
        fileHash,
        userId: clientIP,
        uploadedAt: new Date(),
        size: file.size,
        rowCount,
        columns: header,
        columnCount: header.length,
        isLargeFile: true,
        sampleData,
        // Store file content in chunks
        fileContentChunks: chunkString(fileContent, 10 * 1024 * 1024) // 10MB chunks
      }
      
      await files.insertOne(fileRecord)
    } else {
      // For smaller files, store everything as before
      const fileRecord = {
        fileId,
        fileName: file.name,
        fileHash,
        userId: clientIP,
        uploadedAt: new Date(),
        size: file.size,
        rowCount,
        columns: header,
        columnCount: header.length,
        fileContent, // Store full file content
        allData, // Store parsed data
        isLargeFile: false
      }

      await files.insertOne(fileRecord)
    }

    // Data analysis using appropriate data
    const analysisData = isLargeFile ? allData.slice(0, 1000) : allData
    
    const analysis = {
      totalRows: rowCount,
      totalColumns: header.length,
      columns: header,
      sampleData: analysisData.slice(0, 100), // Always return max 100 rows for UI
      dataTypes: header.map(col => {
        // Type detection based on first 20 values for performance
        const values = analysisData.slice(0, 20).map(row => row[col] || '').filter(val => val !== '')

        if (values.length === 0) return 'unknown'
        
        const isNumeric = values.every(val => !isNaN(Number(val)) && val !== '')
        const isDate = values.every(val => !isNaN(Date.parse(val)))
        
        if (isNumeric) return 'numeric'
        if (isDate) return 'date'
        return 'text'
      }),
      isLargeFile,
      estimatedSize: Math.round(estimatedSize / 1024 / 1024 * 100) / 100 // Size in MB
    }

    return NextResponse.json({
      fileId,
      fileName: file.name,
      analysis
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // Get file data from database
    const files = await getCollection('uploaded_files')
    const fileRecord = await files.findOne({ 
      fileId, 
      userId: session.user.email 
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // If it's a large file with chunks, reconstruct the content
    if (fileRecord.isLargeFile && fileRecord.fileContentChunks) {
      fileRecord.fileContent = reconstructFromChunks(fileRecord.fileContentChunks)
      // Remove chunks from response to reduce size
      delete fileRecord.fileContentChunks
    }

    return NextResponse.json(fileRecord)

  } catch (error) {
    console.error('File retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 