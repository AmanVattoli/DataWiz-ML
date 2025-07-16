import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { BatchProcessor } from '@/lib/batch-processor'

const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)
const batchProcessor = new BatchProcessor()

export async function POST(request: NextRequest) {
  // Get client IP for basic tracking (optional)
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  const body = await request.json()
  const { fileId } = body

  if (!fileId) {
    return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
  }

  // Get file data from database
  const files = await getCollection('uploaded_files')
  const fileRecord = await files.findOne({ 
    fileId
  })
  
  if (!fileRecord) {
    return NextResponse.json({ error: 'File data not found. Please re-upload the file.' }, { status: 404 })
  }

  // Reconstruct file content from chunks if it's a large file
  let fileContent = fileRecord.fileContent
  if (fileRecord.isLargeFile && fileRecord.fileContentChunks && !fileContent) {
    fileContent = fileRecord.fileContentChunks.join('')
  }

  if (!fileContent) {
    return NextResponse.json({ error: 'File content not found. Please re-upload the file.' }, { status: 404 })
  }

  try {
    // Cancel any existing processing for this file
    await batchProcessor.cancelJobsForFile(fileId)

    console.log('🔍 Starting REAL ML comprehensive quality analysis...')
    
    // Check file size before processing
    const fileSizeBytes = Buffer.byteLength(fileContent, 'utf8')
    const fileSizeMB = fileSizeBytes / (1024 * 1024)
    
    console.log(`📊 File size: ${fileSizeMB.toFixed(2)}MB`)
    
    if (fileSizeMB > 50) {
      return NextResponse.json({
        success: false,
        error: `File too large (${fileSizeMB.toFixed(1)}MB). Maximum supported size is 50MB for ML analysis.`,
        analysis: {
          ml_comprehensive_analysis: {
            total_issues: 1,
            issues: [{
              type: 'file_too_large',
              severity: 'high',
              description: `File size (${fileSizeMB.toFixed(1)}MB) exceeds limit for ML analysis`,
              affected_columns: [],
              count: 1,
              ml_confidence: 1.0,
              examples: ['Consider using a smaller sample of your data'],
              tool: 'File Size Check'
            }],
            tools_used: ['File Size Validation'],
            real_ml: false
          }
        },
        timestamp: new Date().toISOString(),
        analysis_type: 'size_limit_exceeded'
      })
    }

    // Create temporary CSV file for Python analysis
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const tempCsvPath = path.join(tempDir, `analysis-${Date.now()}.csv`)
    await writeFile(tempCsvPath, fileContent)
    
    try {
      // Run real ML analysis using Python script
      const mlResults = await runRealMLAnalysis(tempCsvPath)
      
      // Clean up temp file
      await unlink(tempCsvPath)
      
      return NextResponse.json({
        success: true,
        analysis: mlResults,
        timestamp: new Date().toISOString(),
        analysis_type: 'real_ml_comprehensive'
      })
      
    } catch (error) {
      // Clean up temp file even on error
      try {
        await unlink(tempCsvPath)
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError)
      }
      throw error
    }
    
  } catch (error) {
    console.error('❌ Real ML analysis failed:', error)
    
    // Fallback to basic analysis if Python ML fails
    console.log('🔄 Falling back to basic analysis...')
    const fallbackResults = await runFallbackAnalysis(fileContent)
    
    return NextResponse.json({
      success: true,
      analysis: fallbackResults,
      timestamp: new Date().toISOString(),
      analysis_type: 'fallback_basic',
      warning: 'Real ML analysis failed, using basic analysis'
    })
  }
}

async function runRealMLAnalysis(csvPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'scripts', 'data_quality_analyzer.py')
    
    console.log(`🐍 Running Python ML analysis: ${pythonScript}`)
    console.log(`📄 CSV file: ${csvPath}`)
    
    // Ensure paths exist
    if (!fs.existsSync(pythonScript)) {
      throw new Error(`Python script not found: ${pythonScript}`)
    }
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`)
    }
    
    const python = spawn('python', [pythonScript, csvPath], {
      cwd: process.cwd(),
      env: process.env
    })
    
    let stdout = ''
    let stderr = ''
    
    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    python.on('close', (code) => {
      console.log(`🐍 Python process finished with code: ${code}`)
      console.log(`📤 stdout length: ${stdout.length}`)
      console.log(`📤 stderr length: ${stderr.length}`)
      
      if (code !== 0) {
        console.error(`❌ Python script failed with code ${code}`)
        console.error(`stderr: ${stderr}`)
        console.error(`stdout: ${stdout}`)
        reject(new Error(`Python analysis failed with code ${code}. stderr: ${stderr || 'empty'}, stdout: ${stdout || 'empty'}`))
        return
      }
      
      try {
        // Python script now outputs clean JSON only
        const trimmedOutput = stdout.trim()
        if (!trimmedOutput) {
          throw new Error('No output from Python script')
        }
        
        // Try to parse the JSON directly
        const results = JSON.parse(trimmedOutput)
        
        console.log('✅ Real ML analysis completed successfully')
        resolve(transformMLResultsForFrontend(results))
        
      } catch (parseError) {
        console.error('❌ Failed to parse Python output:', parseError)
        console.error('stdout preview:', stdout.substring(0, 500))
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error'
        reject(new Error(`Failed to parse ML results: ${errorMessage}`))
      }
    })
    
    python.on('error', (error) => {
      console.error('❌ Failed to start Python process:', error)
      reject(new Error(`Failed to start Python analysis: ${error.message}`))
    })
  })
}

function transformMLResultsForFrontend(mlResults: any): any {
  // Transform the real ML results into user-friendly format
  const issues: any[] = []
  
  // Process Great Expectations results
  if (mlResults.great_expectations_real?.expectations) {
    mlResults.great_expectations_real.expectations.forEach((expectation: any) => {
      if (!expectation.passes) {
        let userFriendlyDescription = ''
        let issueType = 'data_quality'
        
        if (expectation.expectation.includes('not_be_null')) {
          userFriendlyDescription = `Missing values found in "${expectation.column}"`
          issueType = 'missing_values'
        } else if (expectation.expectation.includes('be_unique')) {
          userFriendlyDescription = `Duplicate values found in "${expectation.column}"`
          issueType = 'duplicates'
        } else {
          userFriendlyDescription = `Data quality issue in "${expectation.column}"`
        }
        
        issues.push({
          type: issueType,
          severity: expectation.expectation.includes('not_be_null') ? 'high' : 'medium',
          description: userFriendlyDescription,
          affected_columns: [expectation.column],
          count: expectation.threshold ? Math.floor((1 - expectation.current_value) * 200) : 1,
          examples: [`Check "${expectation.column}" for data quality issues`]
        })
      }
    })
  }
  
  // Process HoloClean probabilistic errors
  if (mlResults.holoclean_real?.error_details) {
    Object.entries(mlResults.holoclean_real.error_details).forEach(([column, error]: [string, any]) => {
      issues.push({
        type: 'data_inconsistencies',
        severity: error.confidence > 0.9 ? 'high' : 'medium',
        description: `${error.errors_found} potential data inconsistencies in "${column}"`,
        affected_columns: [column],
        count: error.errors_found,
        examples: [`Review "${column}" for potential inconsistencies`]
      })
    })
  }
  
  // Process Cleanlab mislabel detection
  if (mlResults.cleanlab_real?.mislabel_detection) {
    Object.entries(mlResults.cleanlab_real.mislabel_detection).forEach(([column, detection]: [string, any]) => {
      if (detection.total_potential_mislabels > 0) {
        issues.push({
          type: 'potential_mislabels',
          severity: 'medium',
          description: `${detection.total_potential_mislabels} values in "${column}" may need review`,
          affected_columns: [column],
          count: detection.total_potential_mislabels,
          examples: detection.details.slice(0, 3).map((detail: any) => 
            `Row ${detail.row_index}: "${detail.current_label}" might be "${detail.predicted_label}"`
          )
        })
      }
    })
  }
  
  return {
    ml_comprehensive_analysis: {
      total_issues: issues.length,
      issues: issues,
      real_ml: true
    }
  }
}

async function runFallbackAnalysis(csvData: string): Promise<any> {
  // Simple fallback analysis if Python ML fails
  const lines = csvData.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',')
  const dataRows = lines.slice(1)
  
  // Basic analysis to find common issues
  const issues: any[] = []
  
  // Check for empty columns (basic missing value detection)
  headers.forEach(header => {
    const columnValues = dataRows.map(row => {
      const values = row.split(',')
      const index = headers.indexOf(header)
      return values[index]?.trim() || ''
    })
    
    const emptyCount = columnValues.filter(val => !val || val === 'null' || val === 'NULL' || val === 'n/a' || val === 'N/A').length
    if (emptyCount > 0) {
      issues.push({
        type: 'missing_values',
        severity: emptyCount > dataRows.length * 0.5 ? 'high' : 'medium',
        description: `${emptyCount} missing values in "${header}"`,
        affected_columns: [header],
        count: emptyCount,
        examples: ['Check for empty, null, or N/A values']
      })
    }
  })
  
  return {
    ml_comprehensive_analysis: {
      total_issues: issues.length,
      issues: issues,
      real_ml: false
    }
  }
} 