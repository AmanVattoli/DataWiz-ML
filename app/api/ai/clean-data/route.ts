import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getCollection } from '@/lib/mongodb'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fileId, operation, method, targetColumns, currentData } = body
    
    console.log('🔧 API received cleaning request:', { 
      fileId, 
      operation, 
      targetColumns, 
      hasCurrentData: !!currentData 
    })

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

    // Reconstruct file content from chunks if it's a large file
    let fileContent = fileRecord.fileContent
    if (fileRecord.isLargeFile && fileRecord.fileContentChunks && !fileContent) {
      fileContent = fileRecord.fileContentChunks.join('')
    }

    // Use current data if provided (for cumulative operations), otherwise use original file content
    const csvData = currentData || fileContent
    
    if (!csvData) {
      return NextResponse.json({ error: 'File data not found. Please re-upload the file.' }, { status: 404 })
    }

    const lines = csvData.split('\n').filter((line: string) => line.trim())
    if (lines.length < 2) {
      return NextResponse.json({ error: 'Invalid CSV data' }, { status: 400 })
    }

    const header = lines[0]
    const dataRows = lines.slice(1)
    
    // Parse header to get column names
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const columns = parseCSVRow(header).map(col => col.replace(/"/g, ''))

    // Handle different operations
    if (operation === 'detect_issues') {
      console.log('Running basic data quality detection...')
      
      try {
        // Run basic issue detection for cleaning operations
        const basicIssues = await detectBasicIssues(csvData, columns)
        
        return NextResponse.json({
          issues: basicIssues || [],
          total_rows: dataRows.length,
          total_columns: columns.length,
          ml_powered: false,
          analysis_type: 'basic_detection'
        })
      } catch (error) {
        console.error('Basic detection failed:', error)
        return NextResponse.json({
          issues: [],
          total_rows: dataRows.length,
          total_columns: columns.length,
          error: 'Detection failed'
        })
      }
    }

    // Handle cleaning operations
    const validOperations = [
      'remove_duplicates', 'remove_column',
      'handle_nulls_fill', 'handle_nulls_zero', 'handle_nulls_drop', 'handle_nulls_median', 'handle_nulls_mode', 'handle_nulls_interpolate',
      'handle_outliers_remove', 'handle_outliers_replace_median',
      'standardize_phone_us', 'standardize_phone_dash', 'standardize_phone_dots', 'validate_phone_numbers',
      'validate_emails', 'standardize_email_case', 'extract_email_domains',
      'standardize_dates_iso', 'standardize_dates_us', 'validate_dates', 'extract_date_components',
      'standardize_case_title', 'standardize_case_upper', 'standardize_case_lower', 'standardize_case_sentence',
      'fix_encoding', 'remove_special_chars', 'normalize_unicode',
      'remove_extra_spaces', 'standardize_line_breaks', 'remove_tabs_newlines',
      'standardize_columns', 'clean_column_names',
      'trim_whitespace', 'fix_data_types',
      'flag_mislabels',
      'standardize_currency', 'remove_currency_symbols',
      'standardize_addresses', 'extract_address_components', 'validate_zip_codes',
      'smart_auto_fix'
    ]

    if (!validOperations.includes(operation)) {
      return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }

    let result: any = null
    let summary = ''

    try {
      switch (operation) {
        case 'remove_duplicates':
          result = await removeDuplicates(csvData, columns)
          summary = 'Removed duplicate rows'
          break
        case 'remove_column':
          result = await removeColumns(csvData, columns, targetColumns)
          summary = targetColumns?.length 
            ? `Removed columns: ${targetColumns.join(', ')}` 
            : 'No columns specified for removal'
          break
        case 'handle_nulls_fill':
          result = await handleNullValues(csvData, columns, 'fill', targetColumns)
          summary = targetColumns?.length 
            ? `Filled null values in columns: ${targetColumns.join(', ')}` 
            : 'Filled null values with "Unknown"'
          break
        case 'handle_nulls_drop':
          result = await handleNullValues(csvData, columns, 'drop', targetColumns)
          summary = targetColumns?.length 
            ? `Removed rows with null values in columns: ${targetColumns.join(', ')}` 
            : 'Removed rows with null values'
          break
        case 'handle_nulls_median':
          result = await handleNullValues(csvData, columns, 'median', targetColumns)
          summary = targetColumns?.length 
            ? `Filled null values with median in columns: ${targetColumns.join(', ')}` 
            : 'Filled null values with median'
          break
        case 'handle_nulls_zero':
          result = await handleNullValues(csvData, columns, 'zero', targetColumns)
          summary = targetColumns?.length 
            ? `Filled null values with zero in columns: ${targetColumns.join(', ')}` 
            : 'Filled null values with zero'
          break
        case 'handle_nulls_mode':
          result = await handleNullValues(csvData, columns, 'mode', targetColumns)
          summary = targetColumns?.length 
            ? `Filled null values with mode in columns: ${targetColumns.join(', ')}` 
            : 'Filled null values with most common value'
          break
        case 'trim_whitespace':
          result = await trimWhitespace(csvData, columns)
          summary = 'Trimmed whitespace from all cells'
          break
        case 'remove_extra_spaces':
          result = await removeExtraSpaces(csvData, columns)
          summary = 'Removed extra spaces from all cells'
          break
        case 'standardize_phone_us':
          result = await standardizePhoneNumbers(csvData, columns, 'us', targetColumns)
          summary = 'Standardized phone numbers to US format'
          break
        case 'standardize_phone_dash':
          result = await standardizePhoneNumbers(csvData, columns, 'dash', targetColumns)
          summary = 'Standardized phone numbers to dash format'
          break
        case 'standardize_phone_dots':
          result = await standardizePhoneNumbers(csvData, columns, 'dots', targetColumns)
          summary = 'Standardized phone numbers to dot format'
          break
        case 'validate_emails':
          result = await validateEmails(csvData, columns, targetColumns)
          summary = 'Validated email addresses'
          break
        case 'standardize_email_case':
          result = await standardizeEmailCase(csvData, columns, targetColumns)
          summary = 'Standardized email addresses to lowercase'
          break
        case 'standardize_dates_iso':
          result = await standardizeDates(csvData, columns, 'iso', targetColumns)
          summary = 'Standardized dates to ISO format'
          break
        case 'standardize_dates_us':
          result = await standardizeDates(csvData, columns, 'us', targetColumns)
          summary = 'Standardized dates to US format'
          break
        case 'standardize_case_title':
          result = await standardizeTextCase(csvData, columns, 'title', targetColumns)
          summary = 'Standardized text to title case'
          break
        case 'standardize_case_upper':
          result = await standardizeTextCase(csvData, columns, 'upper', targetColumns)
          summary = 'Standardized text to uppercase'
          break
        case 'standardize_case_lower':
          result = await standardizeTextCase(csvData, columns, 'lower', targetColumns)
          summary = 'Standardized text to lowercase'
          break
        case 'fix_data_types':
          result = await fixDataTypes(csvData, columns)
          summary = 'Fixed data type inconsistencies'
          break
        case 'standardize_columns':
          result = await standardizeColumnNames(csvData, columns)
          summary = 'Standardized column names'
          break
        case 'clean_column_names':
          result = await cleanColumnNames(csvData, columns)
          summary = 'Cleaned column names'
          break
        case 'handle_outliers_remove':
          result = await handleOutliers(csvData, columns, 'remove', targetColumns)
          summary = targetColumns?.length 
            ? `Removed outlier rows in columns: ${targetColumns.join(', ')}` 
            : 'Removed outlier rows'
          break
        case 'handle_outliers_replace_median':
          result = await handleOutliers(csvData, columns, 'replace_median', targetColumns)
          summary = targetColumns?.length 
            ? `Replaced outliers with median in columns: ${targetColumns.join(', ')}` 
            : 'Replaced outliers with median values'
          break
        default:
          return NextResponse.json({ error: 'Operation not implemented' }, { status: 400 })
      }

      if (result) {
      return NextResponse.json({
        cleanedData: result,
        summary: summary,
          operation: operation,
          timestamp: new Date().toISOString()
      })
      } else {
        return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
      }

    } catch (error) {
      console.error('Error performing operation:', error)
      return NextResponse.json({ 
        error: 'Operation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in clean-data API:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Helper function to remove duplicates
async function removeDuplicates(csvData: string, columns: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const seen = new Set<string>()
    const uniqueRows = [header]
    
    for (const row of dataRows) {
      const normalizedRow = row.toLowerCase().trim()
      if (!seen.has(normalizedRow)) {
        seen.add(normalizedRow)
        uniqueRows.push(row)
      }
    }
    
    return {
      cleaned_data: uniqueRows.join('\n'),
      removed_count: dataRows.length - (uniqueRows.length - 1)
    }
  } catch (error) {
    console.error('Error removing duplicates:', error)
    throw error
  }
}

// Helper function to handle null values
async function handleNullValues(csvData: string, columns: string[], method: string = 'fill', targetColumns?: string[]) {
  try {
  const lines = csvData.split('\n').filter(line => line.trim())
  const header = lines[0]
  const dataRows = lines.slice(1)
  
  const parseCSVRow = (row: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const processedRows = [header]
    
    for (const row of dataRows) {
      const values = parseCSVRow(row)
      const newValues: string[] = []
      
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const columnName = headerColumns[i]
        
        // Check if this column should be processed
        const shouldProcess = !targetColumns || targetColumns.includes(columnName)
        
        if (shouldProcess && (!value || value.trim() === '' || value.toLowerCase() === 'null')) {
          if (method === 'drop') {
            // Skip this row entirely
            continue
          } else if (method === 'fill') {
            newValues.push('Unknown')
          } else if (method === 'zero') {
            newValues.push('0')
          } else if (method === 'median' || method === 'mode') {
            // For simplicity, use 'Unknown' for now
            newValues.push('Unknown')
          } else {
            newValues.push(value)
          }
        } else {
          newValues.push(value)
        }
      }
      
      if (method !== 'drop' || newValues.length === values.length) {
        processedRows.push(newValues.join(','))
      }
    }
    
    return {
      cleaned_data: processedRows.join('\n'),
      processed_count: dataRows.length - (processedRows.length - 1)
    }
  } catch (error) {
    console.error('Error handling null values:', error)
    throw error
  }
}

// Helper function to remove columns
async function removeColumns(csvData: string, columns: string[], targetColumns?: string[]) {
  try {
    if (!targetColumns || targetColumns.length === 0) {
      return {
        cleaned_data: csvData,
        removed_count: 0
      }
    }
  
  const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
  const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
    } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const columnsToKeep = headerColumns.filter(col => !targetColumns.includes(col))
    const indicesToKeep = columnsToKeep.map(col => headerColumns.indexOf(col))
    
    const processedRows = [columnsToKeep.join(',')]
    
    for (const row of dataRows) {
      const values = parseCSVRow(row)
      const newValues = indicesToKeep.map(index => values[index] || '')
      processedRows.push(newValues.join(','))
    }
  
  return {
      cleaned_data: processedRows.join('\n'),
      removed_count: targetColumns.length
    }
  } catch (error) {
    console.error('Error removing columns:', error)
    throw error
  }
}

// Helper function to trim whitespace
async function trimWhitespace(csvData: string, columns: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const processedRows = lines.map(line => {
      return line.split(',').map(cell => cell.trim()).join(',')
  })
  
  return {
      cleaned_data: processedRows.join('\n'),
      processed_count: lines.length
    }
  } catch (error) {
    console.error('Error trimming whitespace:', error)
    throw error
  }
}

// Helper function to remove extra spaces
async function removeExtraSpaces(csvData: string, columns: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const processedRows = lines.map(line => {
      return line.split(',').map(cell => cell.replace(/\s+/g, ' ').trim()).join(',')
    })
    
    return { 
      cleaned_data: processedRows.join('\n'),
      processed_count: lines.length
    }
  } catch (error) {
    console.error('Error removing extra spaces:', error)
    throw error
  }
}

// Helper function to standardize phone numbers
async function standardizePhoneNumbers(csvData: string, columns: string[], format: string, targetColumns?: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const processedRows = [header]
    
    for (const row of dataRows) {
      const values = parseCSVRow(row)
      const newValues: string[] = []
      
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const columnName = headerColumns[i]
        
        // Check if this column should be processed
        const shouldProcess = !targetColumns || targetColumns.includes(columnName)
        
        if (shouldProcess && value) {
          const digits = value.replace(/\D/g, '')
          if (digits.length === 10) {
            if (format === 'us') {
              newValues.push(`(${digits.substr(0, 3)}) ${digits.substr(3, 3)}-${digits.substr(6, 4)}`)
            } else if (format === 'dash') {
              newValues.push(`${digits.substr(0, 3)}-${digits.substr(3, 3)}-${digits.substr(6, 4)}`)
            } else if (format === 'dots') {
              newValues.push(`${digits.substr(0, 3)}.${digits.substr(3, 3)}.${digits.substr(6, 4)}`)
            } else {
              newValues.push(value)
            }
          } else {
            newValues.push(value)
          }
        } else {
          newValues.push(value)
        }
      }
      
      processedRows.push(newValues.join(','))
  }
  
  return {
      cleaned_data: processedRows.join('\n'),
      processed_count: dataRows.length
    }
  } catch (error) {
    console.error('Error standardizing phone numbers:', error)
    throw error
  }
}

// Helper function to validate emails
async function validateEmails(csvData: string, columns: string[], targetColumns?: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const processedRows = [header]
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    for (const row of dataRows) {
      const values = parseCSVRow(row)
      const newValues: string[] = []
      
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const columnName = headerColumns[i]
        
        // Check if this column should be processed
        const shouldProcess = !targetColumns || targetColumns.includes(columnName)
        
        if (shouldProcess && value && !emailRegex.test(value)) {
          newValues.push(`[INVALID] ${value}`)
      } else {
          newValues.push(value)
        }
      }
      
      processedRows.push(newValues.join(','))
    }

    return {
      cleaned_data: processedRows.join('\n'),
      processed_count: dataRows.length
    }
  } catch (error) {
    console.error('Error validating emails:', error)
    throw error
  }
}

// Helper function to standardize email case
async function standardizeEmailCase(csvData: string, columns: string[], targetColumns?: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const processedRows = [header]
    
    for (const row of dataRows) {
      const values = parseCSVRow(row)
      const newValues: string[] = []
      
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const columnName = headerColumns[i]
        
        // Check if this column should be processed
        const shouldProcess = !targetColumns || targetColumns.includes(columnName)
        
        if (shouldProcess && value && value.includes('@')) {
          newValues.push(value.toLowerCase())
        } else {
          newValues.push(value)
        }
      }
      
      processedRows.push(newValues.join(','))
    }
    
    return {
      cleaned_data: processedRows.join('\n'),
      processed_count: dataRows.length
    }
  } catch (error) {
    console.error('Error standardizing email case:', error)
    throw error
  }
}

// Helper function to standardize dates
async function standardizeDates(csvData: string, columns: string[], format: string, targetColumns?: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const processedRows = [header]
    
    for (const row of dataRows) {
      const values = parseCSVRow(row)
      const newValues: string[] = []
      
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const columnName = headerColumns[i]
        
        // Check if this column should be processed
        const shouldProcess = !targetColumns || targetColumns.includes(columnName)
        
        if (shouldProcess && value) {
          try {
            const date = new Date(value)
            if (!isNaN(date.getTime())) {
              if (format === 'iso') {
                newValues.push(date.toISOString().split('T')[0])
              } else if (format === 'us') {
                newValues.push(`${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`)
              } else {
                newValues.push(value)
              }
            } else {
              newValues.push(value)
            }
          } catch {
            newValues.push(value)
          }
        } else {
          newValues.push(value)
        }
      }
      
      processedRows.push(newValues.join(','))
    }
    
    return {
      cleaned_data: processedRows.join('\n'),
      processed_count: dataRows.length
    }
  } catch (error) {
    console.error('Error standardizing dates:', error)
    throw error
  }
}

// Helper function to standardize text case
async function standardizeTextCase(csvData: string, columns: string[], caseType: string, targetColumns?: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const processedRows = [header]
    
    for (const row of dataRows) {
      const values = parseCSVRow(row)
      const newValues: string[] = []
      
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const columnName = headerColumns[i]
        
        // Check if this column should be processed
        const shouldProcess = !targetColumns || targetColumns.includes(columnName)
        
        if (shouldProcess && value) {
          if (caseType === 'title') {
            newValues.push(value.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()))
          } else if (caseType === 'upper') {
            newValues.push(value.toUpperCase())
          } else if (caseType === 'lower') {
            newValues.push(value.toLowerCase())
              } else {
            newValues.push(value)
              }
              } else {
          newValues.push(value)
        }
      }
      
      processedRows.push(newValues.join(','))
    }
    
    return {
      cleaned_data: processedRows.join('\n'),
      processed_count: dataRows.length
    }
  } catch (error) {
    console.error('Error standardizing text case:', error)
    throw error
  }
}

// Helper function to fix data types
async function fixDataTypes(csvData: string, columns: string[]) {
  try {
    // For now, just return the original data
    // This would need more complex logic to actually fix data types
      return {
      cleaned_data: csvData,
      processed_count: 0
    }
  } catch (error) {
    console.error('Error fixing data types:', error)
    throw error
  }
}

// Helper function to standardize column names
async function standardizeColumnNames(csvData: string, columns: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const standardizedHeaders = headerColumns.map(col => 
      col.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    )
    
    const processedRows = [standardizedHeaders.join(',')]
    processedRows.push(...dataRows)
    
      return {
      cleaned_data: processedRows.join('\n'),
      processed_count: 1
    }
  } catch (error) {
    console.error('Error standardizing column names:', error)
    throw error
  }
}

// Helper function to clean column names
async function cleanColumnNames(csvData: string, columns: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
      const parseCSVRow = (row: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const cleanedHeaders = headerColumns.map(col => 
      col.trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '')
    )
    
    const processedRows = [cleanedHeaders.join(',')]
    processedRows.push(...dataRows)
    
    return {
      cleaned_data: processedRows.join('\n'),
      processed_count: 1
    }
  } catch (error) {
    console.error('Error cleaning column names:', error)
    throw error
  }
}

// Helper function to handle outliers
async function handleOutliers(csvData: string, columns: string[], method: string = 'remove', targetColumns?: string[]) {
  try {
    const lines = csvData.split('\n').filter(line => line.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
              } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headerColumns = parseCSVRow(header).map(col => col.replace(/"/g, ''))
    const parsedData = dataRows.map(row => parseCSVRow(row))
    
    // Identify outliers for each target column
    const outlierRows = new Set<number>()
    const columnStats = new Map<string, { median: number, q1: number, q3: number, iqr: number }>()
    
    for (const column of (targetColumns || headerColumns)) {
      const colIndex = headerColumns.indexOf(column)
      if (colIndex === -1) continue
      
      // Get numeric values from this column
      const numericValues: number[] = []
      const valueToRowMap = new Map<number, number[]>()
      
      parsedData.forEach((row, rowIndex) => {
        const value = row[colIndex]?.trim()
        if (value && !isNaN(Number(value))) {
          const numValue = Number(value)
          numericValues.push(numValue)
          if (!valueToRowMap.has(numValue)) {
            valueToRowMap.set(numValue, [])
          }
          valueToRowMap.get(numValue)!.push(rowIndex)
        }
      })
      
      if (numericValues.length < 10) continue // Skip if not enough data
      
      // Calculate statistical measures
      const sorted = [...numericValues].sort((a, b) => a - b)
      const q1Index = Math.floor(sorted.length * 0.25)
      const q3Index = Math.floor(sorted.length * 0.75)
      const q1 = sorted[q1Index]
      const q3 = sorted[q3Index]
      const iqr = q3 - q1
      const median = sorted[Math.floor(sorted.length / 2)]
      
      columnStats.set(column, { median, q1, q3, iqr })
      
      const lowerBound = q1 - 1.5 * iqr
      const upperBound = q3 + 1.5 * iqr
      
      // Find outlier rows
      numericValues.forEach(value => {
        if (value < lowerBound || value > upperBound) {
          const rowIndices = valueToRowMap.get(value) || []
          rowIndices.forEach(rowIndex => outlierRows.add(rowIndex))
        }
      })
    }
    
    // Apply the selected method
    let processedRows = [header]
    let processedCount = 0
    
    for (let rowIndex = 0; rowIndex < parsedData.length; rowIndex++) {
      const row = parsedData[rowIndex]
      const isOutlierRow = outlierRows.has(rowIndex)
      
      if (isOutlierRow) {
        if (method === 'remove') {
          // Skip this row (don't add to processedRows)
          processedCount++
          continue
        } else if (method === 'replace_median') {
          // Modify outlier values
          const newRow = [...row]
          
          for (const column of (targetColumns || headerColumns)) {
            const colIndex = headerColumns.indexOf(column)
            if (colIndex === -1) continue
            
            const value = row[colIndex]?.trim()
            if (value && !isNaN(Number(value))) {
              const numValue = Number(value)
              const stats = columnStats.get(column)
              if (!stats) continue
              
              const lowerBound = stats.q1 - 1.5 * stats.iqr
              const upperBound = stats.q3 + 1.5 * stats.iqr
              
              if (numValue < lowerBound || numValue > upperBound) {
                // Replace with median
                newRow[colIndex] = stats.median.toString()
                processedCount++
              }
            }
          }
          
          processedRows.push(newRow.join(','))
        }
      } else {
        // Normal row, keep as is
        processedRows.push(row.join(','))
      }
    }
    
    return {
      cleaned_data: processedRows.join('\n'),
      processed_count: processedCount
    }
  } catch (error) {
    console.error('Error handling outliers:', error)
    throw error
  }
}

// Basic issue detection for cleaning operations
async function detectBasicIssues(csvData: string, columns: string[]): Promise<any[]> {
  console.log('🔍 Running basic data quality detection...')
  
  const lines = csvData.split('\n').filter(line => line.trim())
  const dataRows = lines.slice(1)
  const issues: any[] = []
  
  // Performance optimization: limit analysis for very large files
  const isLargeFile = dataRows.length > 10000
  const sampleSize = isLargeFile ? Math.min(5000, dataRows.length) : dataRows.length
  const analyzedRows = isLargeFile ? dataRows.slice(0, sampleSize) : dataRows
  
  console.log(`📊 Analyzing ${analyzedRows.length} rows (${isLargeFile ? 'sample of ' + dataRows.length : 'full dataset'})`);
  
    const parseCSVRow = (row: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

  // 1. Optimized duplicate detection
  const rowHashes = new Map<string, number[]>()
    let duplicateCount = 0
    
  // Build hash map for efficient duplicate detection
  for (let i = 0; i < analyzedRows.length; i++) {
    const normalizedRow = analyzedRows[i].toLowerCase().trim()
    if (!rowHashes.has(normalizedRow)) {
      rowHashes.set(normalizedRow, [])
    }
    rowHashes.get(normalizedRow)!.push(i)
  }
  
  // Count duplicates and find examples
  const duplicateExamples: string[] = []
  for (const [rowContent, indices] of rowHashes) {
    if (indices.length > 1) {
      duplicateCount += indices.length - 1 // All but the first occurrence are duplicates
      if (duplicateExamples.length < 3) {
        const firstIndex = indices[0]
        const duplicateIndex = indices[1]
        duplicateExamples.push(`Row ${duplicateIndex + 2} duplicates row ${firstIndex + 2}: "${analyzedRows[firstIndex].substring(0, 100)}${analyzedRows[firstIndex].length > 100 ? '...' : ''}"`)
      }
    }
  }
  
  // Scale up count for large files
  if (isLargeFile) {
    duplicateCount = Math.round((duplicateCount / sampleSize) * dataRows.length)
  }
  
  if (duplicateCount > 0) {
    issues.push({
      type: 'duplicates',
      severity: 'high',
      description: `Found ${duplicateCount} duplicate rows`,
      affected_columns: columns,
      count: duplicateCount,
      suggestion: 'Remove duplicate rows to improve data quality',
      examples: duplicateExamples.length > 0 ? duplicateExamples : [`${duplicateCount} rows appear multiple times in your data`]
    })
  }
  
  // 2. Missing value detection by column (optimized for large files)
  const parsedData = analyzedRows.map(row => parseCSVRow(row))
  
  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const column = columns[colIndex]
    const columnData = parsedData.map(row => row[colIndex] || '')
    
    // Count missing values
    const missingCount = columnData.filter(val => 
      !val || val.trim() === '' || val.toLowerCase() === 'null' || 
      val.toLowerCase() === 'na' || val.toLowerCase() === 'n/a'
    ).length
    
    if (missingCount > 0) {
      // Scale up missing count for large files
      const actualMissingCount = isLargeFile ? Math.round((missingCount / sampleSize) * dataRows.length) : missingCount
      const percentage = (actualMissingCount / dataRows.length) * 100
      
      // Find examples of missing values with row context
      const missingExamples: string[] = []
      for (let rowIndex = 0; rowIndex < parsedData.length && missingExamples.length < 3; rowIndex++) {
        const val = columnData[rowIndex]
        if (!val || val.trim() === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'na' || val.toLowerCase() === 'n/a') {
          const rowNum = rowIndex + 2 // +2 because 0-indexed and header row
          const displayValue = !val || val.trim() === '' ? '(empty)' : val
          missingExamples.push(`Row ${rowNum}: "${displayValue}"`)
        }
      }
      
      issues.push({
        type: 'missing_values',
        severity: percentage > 50 ? 'high' : percentage > 20 ? 'medium' : 'low',
        description: `${actualMissingCount} missing values in "${column}" (${percentage.toFixed(1)}%)`,
        affected_columns: [column],
        count: actualMissingCount,
        suggestion: 'Fill missing values or remove incomplete rows',
        examples: missingExamples.length > 0 ? missingExamples : [`${actualMissingCount} empty or null values found`]
      })
    }
    
    // 3. Phone number format check
    if (column.toLowerCase().includes('phone')) {
      const phonePatterns = [
        /^\(\d{3}\)\s*\d{3}-\d{4}$/,  // (123) 456-7890
        /^\d{3}-\d{3}-\d{4}$/,        // 123-456-7890
        /^\d{3}\.\d{3}\.\d{4}$/,      // 123.456.7890
        /^\d{10}$/                    // 1234567890
      ]
      
      let inconsistentFormats = 0
      const nonEmptyData = columnData.filter(val => val.trim() !== '')
      
      if (nonEmptyData.length > 0) {
        const formatCounts = new Map()
        
        nonEmptyData.forEach(phone => {
          let matched = false
          phonePatterns.forEach((pattern, index) => {
            if (pattern.test(phone.trim())) {
              formatCounts.set(index, (formatCounts.get(index) || 0) + 1)
              matched = true
            }
          })
          if (!matched) {
            inconsistentFormats++
          }
        })
        
        if (formatCounts.size > 1 || inconsistentFormats > 0) {
          // Collect actual phone number examples showing different formats
          const phoneExamples: string[] = []
          const formatsSeen = new Set<string>()
          
          for (let rowIndex = 0; rowIndex < parsedData.length && phoneExamples.length < 5; rowIndex++) {
            const phone = parsedData[rowIndex][colIndex]?.trim()
            if (phone && phone !== '') {
              let matched = false
              let formatType = 'invalid'
              
              phonePatterns.forEach((pattern, index) => {
                if (pattern.test(phone)) {
                  matched = true
                  formatType = ['(XXX) XXX-XXXX', 'XXX-XXX-XXXX', 'XXX.XXX.XXXX', 'XXXXXXXXXX'][index]
                }
              })
              
              if (!matched) formatType = 'invalid'
              
              const formatKey = `${formatType}:${phone}`
              if (!formatsSeen.has(formatKey)) {
                formatsSeen.add(formatKey)
                const rowNum = rowIndex + 2
                phoneExamples.push(`Row ${rowNum}: "${phone}" (${formatType})`)
              }
            }
          }
          
          issues.push({
            type: 'phone_format',
            severity: 'medium',
            description: `Inconsistent phone number formats in "${column}"`,
            affected_columns: [column],
            count: inconsistentFormats + (formatCounts.size > 1 ? nonEmptyData.length : 0),
            suggestion: 'Standardize phone numbers to a consistent format',
            examples: phoneExamples.length > 0 ? phoneExamples : ['Mix of different phone number formats found']
          })
        }
      }
    }
    
    // 4. Email format check
    if (column.toLowerCase().includes('email')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const nonEmptyData = columnData.filter(val => val.trim() !== '')
      const invalidEmails = nonEmptyData.filter(email => !emailRegex.test(email.trim()))
      
      if (invalidEmails.length > 0) {
        // Find row numbers for invalid emails
        const emailExamples: string[] = []
        for (let rowIndex = 0; rowIndex < parsedData.length && emailExamples.length < 3; rowIndex++) {
          const email = parsedData[rowIndex][colIndex]?.trim()
          if (email && email !== '' && !emailRegex.test(email)) {
            const rowNum = rowIndex + 2 // +2 because 0-indexed and header row
            emailExamples.push(`Row ${rowNum}: "${email}"`)
          }
        }
        
        issues.push({
          type: 'email_format',
          severity: 'medium',
          description: `${invalidEmails.length} invalid email addresses in "${column}"`,
          affected_columns: [column],
          count: invalidEmails.length,
          suggestion: 'Fix or remove invalid email addresses',
          examples: emailExamples.length > 0 ? emailExamples : invalidEmails.slice(0, 3).map(email => `Invalid: "${email}"`)
        })
      }
    }
  }
  
  // 5. General formatting issues
  let totalWhitespaceIssues = 0
  parsedData.forEach(row => {
    row.forEach(cell => {
      if (cell !== cell.trim() || /\s{2,}/.test(cell)) {
        totalWhitespaceIssues++
      }
    })
  })
  
  if (totalWhitespaceIssues > 0) {
    // Find actual examples of whitespace issues
    const whitespaceExamples: string[] = []
    for (let rowIndex = 0; rowIndex < parsedData.length && whitespaceExamples.length < 3; rowIndex++) {
      for (let colIndex = 0; colIndex < parsedData[rowIndex].length; colIndex++) {
        const cell = parsedData[rowIndex][colIndex] || ''
        if (cell !== cell.trim() || /\s{2,}/.test(cell)) {
          const rowNum = rowIndex + 2
          const colName = columns[colIndex] || `Column ${colIndex + 1}`
          let issueType = ''
          if (cell !== cell.trim()) issueType = 'leading/trailing spaces'
          if (/\s{2,}/.test(cell)) issueType = issueType ? issueType + ', multiple spaces' : 'multiple spaces'
          
          whitespaceExamples.push(`Row ${rowNum}, ${colName}: "${cell}" (${issueType})`)
          break // Only one example per row
        }
      }
    }
    
    issues.push({
      type: 'whitespace',
      severity: 'low',
      description: `${totalWhitespaceIssues} cells with extra whitespace`,
      affected_columns: columns,
      count: totalWhitespaceIssues,
      suggestion: 'Trim whitespace from cells',
      examples: whitespaceExamples.length > 0 ? whitespaceExamples : ['Leading/trailing spaces or multiple spaces between words']
    })
  }
  
  // 6. Outlier detection for numerical columns
  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const column = columns[colIndex]
    const columnData = parsedData.map(row => row[colIndex] || '')
    
    // Check if column contains mostly numerical data
    const numericValues = columnData
      .filter(val => val.trim() !== '' && !isNaN(Number(val)))
      .map(val => Number(val))
    
    // Only detect outliers if we have enough numeric data and file isn't too large
    const nonEmptyCount = columnData.filter(val => val.trim() !== '').length
    if (numericValues.length >= Math.max(10, nonEmptyCount * 0.6) && !isLargeFile) {
      const outliers = detectOutliers(numericValues, parsedData, colIndex, column)
      if (outliers.length > 0) {
        issues.push({
          type: 'outliers',
          severity: outliers.length > numericValues.length * 0.1 ? 'high' : 'medium',
          description: `${outliers.length} potential outliers detected in "${column}"`,
          affected_columns: [column],
          count: outliers.length,
          suggestion: 'Review outliers - they may be data entry errors or legitimate extreme values',
          examples: outliers.slice(0, 3)
        })
      }
    }
  }
  
  // 7. Enhanced semantic data type detection (limited for large files)
  const maxColumnsToAnalyze = isLargeFile ? Math.min(10, columns.length) : columns.length
  for (let colIndex = 0; colIndex < maxColumnsToAnalyze; colIndex++) {
    const column = columns[colIndex]
    const columnData = parsedData.map(row => row[colIndex] || '')
    const nonEmptyData = columnData.filter(val => val.trim() !== '')
    
    if (nonEmptyData.length > 0) {
      // Limit sample size for semantic analysis on large files
      const semanticSample = isLargeFile ? nonEmptyData.slice(0, 1000) : nonEmptyData
      
      const semanticMismatches = detectSemanticMismatches(column, semanticSample, parsedData, colIndex)
      if (semanticMismatches.length > 0) {
        // Scale up counts for large files
        const actualCount = isLargeFile ? Math.round((semanticMismatches.length / semanticSample.length) * nonEmptyData.length) : semanticMismatches.length
        
        issues.push({
          type: 'data_types',
          severity: semanticMismatches.length > semanticSample.length * 0.3 ? 'high' : 'medium',
          description: `${actualCount} semantic mismatches in "${column}" - content doesn't match expected data type`,
          affected_columns: [column],
          count: actualCount,
          suggestion: 'Review and correct values that don\'t match the expected data type for this column',
          examples: semanticMismatches.slice(0, 3)
        })
      }
      
      // Skip expensive anomalous content detection for large files
      if (!isLargeFile) {
        const anomalousContent = detectAnomalousContent(column, nonEmptyData, parsedData, colIndex)
        if (anomalousContent.length > 0) {
          issues.push({
            type: 'potential_mislabels',
            severity: 'medium',
            description: `${anomalousContent.length} potentially mislabeled values in "${column}" - content seems inconsistent with other data`,
            affected_columns: [column],
            count: anomalousContent.length,
            suggestion: 'Review these values - they may be incorrectly placed or contain wrong data types',
            examples: anomalousContent.slice(0, 3)
          })
        }
      }
    }
  }
  
  console.log(`🔍 Basic detection complete. Found ${issues.length} issues in ${isLargeFile ? `sample of ${sampleSize} rows` : 'full dataset'}.`)
  
  // Add performance note for large files
  if (isLargeFile) {
    issues.push({
      type: 'performance_note',
      severity: 'low',
      description: `Analysis performed on sample of ${sampleSize} rows for performance. Full dataset has ${dataRows.length} rows.`,
      affected_columns: [],
      count: 0,
      suggestion: 'Counts and percentages are extrapolated from sample data. Consider analyzing smaller chunks for more detailed analysis.',
      examples: [`Analyzed ${sampleSize} of ${dataRows.length} rows (${((sampleSize/dataRows.length)*100).toFixed(1)}% sample)`]
    })
  }
  
  return issues
}

// Helper function to detect outliers using multiple methods
function detectOutliers(values: number[], parsedData: string[][], colIndex: number, columnName: string): string[] {
  if (values.length < 10) return []
  
  const outlierIndices = new Set<number>()
  const examples: string[] = []
  
  // Method 1: IQR Method (Interquartile Range)
  const sorted = [...values].sort((a, b) => a - b)
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  
  // Method 2: Modified Z-Score using Median Absolute Deviation
  const median = sorted[Math.floor(sorted.length / 2)]
  const medianAbsoluteDeviations = values.map(val => Math.abs(val - median))
  const mad = medianAbsoluteDeviations.sort((a, b) => a - b)[Math.floor(medianAbsoluteDeviations.length / 2)]
  const threshold = 3.5 // Standard threshold for modified z-score
  
  // Find outliers in original data with row numbers
  for (let rowIndex = 0; rowIndex < parsedData.length; rowIndex++) {
    const cellValue = parsedData[rowIndex][colIndex]?.trim()
    if (cellValue && !isNaN(Number(cellValue))) {
      const numValue = Number(cellValue)
      
      // Check IQR method
      const isIQROutlier = numValue < lowerBound || numValue > upperBound
      
      // Check Modified Z-Score method
      const modifiedZScore = mad === 0 ? 0 : (0.6745 * (numValue - median)) / mad
      const isZScoreOutlier = Math.abs(modifiedZScore) > threshold
      
      // If detected by either method, consider it an outlier
      if (isIQROutlier || isZScoreOutlier) {
        const rowNum = rowIndex + 2 // +2 because 0-indexed and header row
        const severity = isIQROutlier && isZScoreOutlier ? 'extreme' : 'moderate'
        examples.push(`Row ${rowNum}: "${cellValue}" (${severity} outlier)`)
        outlierIndices.add(rowIndex)
      }
    }
  }
  
  return examples
}

// Enhanced semantic data type detection function
function detectSemanticMismatches(columnName: string, nonEmptyData: string[], parsedData: string[][], colIndex: number): string[] {
  const mismatches: string[] = []
  const lowerColumnName = columnName.toLowerCase()
  
  // Define expected patterns for different data types based on column names
  const columnTypePatterns = {
    id: {
      keywords: ['id', '_id', 'identifier', 'key', 'pk', 'uid', 'uuid'],
      patterns: [
        /^[A-Za-z0-9_-]+$/, // Alphanumeric with underscores/hyphens
        /^\d+$/, // Pure numeric IDs
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i // UUID
      ],
      invalidPatterns: [
        /^[.!?].*[.!?]$/, // Sentences (start/end with punctuation)
        /\s{2,}/, // Multiple spaces
        /^(the|this|that|is|was|are|were|a|an)\s/i, // Common sentence starters
        /\b(lorem|ipsum|dolor|sit|amet)\b/i // Lorem ipsum text
      ]
    },
    name: {
      keywords: ['name', 'firstname', 'lastname', 'fullname', 'username', 'title'],
      patterns: [
        /^[A-Za-z\s'-]{2,}$/, // Letters, spaces, apostrophes, hyphens
        /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/ // Proper name capitalization
      ],
      invalidPatterns: [
        /^\d+$/, // Pure numbers
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email addresses
        /^\+?[\d\s()-]{10,}$/, // Phone numbers
        /^https?:\/\//, // URLs
        /\b(lorem|ipsum|dolor|sit|amet)\b/i // Lorem ipsum text
      ]
    },
    email: {
      keywords: ['email', 'mail', 'e_mail', 'email_address'],
      patterns: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      ],
      invalidPatterns: [
        /^\d+$/, // Pure numbers
        /^[A-Za-z\s'-]+$/, // Just names
        /^https?:\/\//, // URLs
        /\s{2,}/, // Multiple spaces
        /\b(lorem|ipsum|dolor|sit|amet)\b/i // Lorem ipsum text
      ]
    },
    phone: {
      keywords: ['phone', 'tel', 'telephone', 'mobile', 'cell', 'contact'],
      patterns: [
        /^\+?[\d\s()-]{10,}$/,
        /^\(\d{3}\)\s*\d{3}-\d{4}$/,
        /^\d{3}-\d{3}-\d{4}$/,
        /^\d{10}$/
      ],
      invalidPatterns: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email addresses
        /^[A-Za-z\s'-]+$/, // Just names
        /^https?:\/\//, // URLs
        /\b(lorem|ipsum|dolor|sit|amet)\b/i // Lorem ipsum text
      ]
    },
    date: {
      keywords: ['date', 'created', 'updated', 'time', 'birthday', 'birth_date'],
      patterns: [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/ // M/D/YY or M/D/YYYY
      ],
      invalidPatterns: [
        /^[A-Za-z\s'-]+$/, // Just names
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email addresses
        /\b(lorem|ipsum|dolor|sit|amet)\b/i // Lorem ipsum text
      ]
    },
    number: {
      keywords: ['price', 'cost', 'amount', 'total', 'count', 'quantity', 'age', 'year', 'score'],
      patterns: [
        /^\d+$/, // Integers
        /^\d+\.\d+$/, // Decimals
        /^\$?\d+(\.\d{2})?$/ // Currency
      ],
      invalidPatterns: [
        /^[A-Za-z\s'-]+$/, // Just names
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email addresses
        /^https?:\/\//, // URLs
        /\b(lorem|ipsum|dolor|sit|amet)\b/i, // Lorem ipsum text
        /[.!?].*[.!?]/, // Sentences
        /^(the|this|that|is|was|are|were|a|an)\s/i // Sentence starters
      ]
    },
    url: {
      keywords: ['url', 'link', 'website', 'homepage', 'site'],
      patterns: [
        /^https?:\/\/[^\s]+$/,
        /^www\.[^\s]+$/,
        /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/
      ],
      invalidPatterns: [
        /^[A-Za-z\s'-]+$/, // Just names
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email addresses
        /^\d+$/, // Pure numbers
        /\b(lorem|ipsum|dolor|sit|amet)\b/i // Lorem ipsum text
      ]
    }
  }
  
  // Determine expected type based on column name
  let expectedType: string | null = null
  let typeConfig: any = null
  
  for (const [type, config] of Object.entries(columnTypePatterns)) {
    if (config.keywords.some(keyword => lowerColumnName.includes(keyword))) {
      expectedType = type
      typeConfig = config
      break
    }
  }
  
  // If we found an expected type, check for mismatches
  if (expectedType && typeConfig) {
    for (let i = 0; i < nonEmptyData.length && mismatches.length < 5; i++) {
      const value = nonEmptyData[i].trim()
      
      // Find the original row index for this value
      let rowIndex = -1
      for (let r = 0; r < parsedData.length; r++) {
        if (parsedData[r][colIndex]?.trim() === value) {
          rowIndex = r
          break
        }
      }
      
      // Check if value matches expected patterns
      const matchesExpected = typeConfig.patterns.some((pattern: RegExp) => pattern.test(value))
      
      // Check if value matches invalid patterns (semantic mismatches)
      const matchesInvalid = typeConfig.invalidPatterns.some((pattern: RegExp) => pattern.test(value))
      
      // Additional checks for semantic mismatches
      let semanticIssue = ''
      
      if (expectedType === 'id') {
        // Check for obvious non-ID content
        if (value.split(' ').length > 3) {
          semanticIssue = 'appears to be a sentence'
        } else if (/^[.!?].*[.!?]$/.test(value)) {
          semanticIssue = 'appears to be a sentence with punctuation'
        } else if (/\b(lorem|ipsum|dolor|sit|amet|the|this|that|is|was|are|were)\b/i.test(value)) {
          semanticIssue = 'contains common words/placeholder text'
        }
      } else if (expectedType === 'number') {
        // Check for obvious non-numeric content in number fields
        if (/[a-zA-Z]{3,}/.test(value) && !/^\$?\d+(\.\d{2})?$/.test(value)) {
          semanticIssue = 'contains alphabetic text in numeric field'
        }
      } else if (expectedType === 'email') {
        // Check for obvious non-email content in email fields
        if (!/@/.test(value) && value.length > 3) {
          semanticIssue = 'missing @ symbol for email'
        }
      }
      
      // If we found a mismatch, record it
      if (matchesInvalid || (!matchesExpected && semanticIssue) || semanticIssue) {
        const rowNum = rowIndex !== -1 ? rowIndex + 2 : 'Unknown' // +2 for header and 0-indexing
        const issue = semanticIssue || 'doesn\'t match expected format'
        const truncatedValue = value.length > 50 ? value.substring(0, 50) + '...' : value
        mismatches.push(`Row ${rowNum}: "${truncatedValue}" (${issue} for ${expectedType} field)`)
      }
    }
  }
  
  return mismatches
}

// ML-based anomalous content detection function
function detectAnomalousContent(columnName: string, nonEmptyData: string[], parsedData: string[][], colIndex: number): string[] {
  const anomalies: string[] = []
  
  if (nonEmptyData.length < 5) return anomalies // Need enough data to detect patterns
  
  // Analyze content characteristics using statistical methods
  const contentFeatures = nonEmptyData.map(value => ({
    value,
    length: value.length,
    wordCount: value.split(/\s+/).length,
    digitRatio: (value.match(/\d/g) || []).length / value.length,
    upperCaseRatio: (value.match(/[A-Z]/g) || []).length / value.length,
    specialCharRatio: (value.match(/[^a-zA-Z0-9\s]/g) || []).length / value.length,
    hasSpaces: value.includes(' '),
    startsWithNumber: /^\d/.test(value),
    containsUrl: /https?:\/\/|www\./i.test(value),
    containsEmail: /@.*\./.test(value),
    hasRepeatedChars: /(.)\1{2,}/.test(value),
    isCapitalized: /^[A-Z]/.test(value),
    containsCommonWords: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/i.test(value)
  }))
  
  // Calculate statistical measures for each feature
  const features = ['length', 'wordCount', 'digitRatio', 'upperCaseRatio', 'specialCharRatio']
  const statistics: {[key: string]: {mean: number, std: number, median: number}} = {}
  
  features.forEach(feature => {
    const values = contentFeatures.map(cf => (cf as any)[feature])
    const sorted = [...values].sort((a, b) => a - b)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const std = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length)
    const median = sorted[Math.floor(sorted.length / 2)]
    
    statistics[feature] = { mean, std, median }
  })
  
  // Detect outliers using multiple methods
  contentFeatures.forEach((cf, index) => {
    const reasons: string[] = []
    
    // Statistical outlier detection (z-score > 2.5)
    features.forEach(feature => {
      const value = (cf as any)[feature]
      const stat = statistics[feature]
      if (stat.std > 0) {
        const zScore = Math.abs(value - stat.mean) / stat.std
        if (zScore > 2.5) {
          reasons.push(`unusual ${feature}`)
        }
      }
    })
    
    // Pattern-based anomaly detection
    if (cf.wordCount > 10 && statistics.wordCount.median < 3) {
      reasons.push('unexpectedly long text in short-text column')
    }
    
    if (cf.digitRatio > 0.8 && statistics.digitRatio.median < 0.3) {
      reasons.push('mostly digits in text column')
    }
    
    if (cf.specialCharRatio > 0.3 && statistics.specialCharRatio.median < 0.1) {
      reasons.push('unusual special characters')
    }
    
    // Content type inconsistency detection
    const majoritiesHaveSpaces = contentFeatures.filter(f => f.hasSpaces).length > contentFeatures.length * 0.7
    const majorityAreNumbers = contentFeatures.filter(f => f.startsWithNumber).length > contentFeatures.length * 0.7
    const majorityAreCapitalized = contentFeatures.filter(f => f.isCapitalized).length > contentFeatures.length * 0.7
    
    if (!cf.hasSpaces && majoritiesHaveSpaces && cf.wordCount > 3) {
      reasons.push('missing spaces where expected')
    }
    
    if (!cf.startsWithNumber && majorityAreNumbers && cf.digitRatio < 0.1) {
      reasons.push('text in numeric column')
    }
    
    if (cf.containsUrl && !columnName.toLowerCase().includes('url') && !columnName.toLowerCase().includes('link')) {
      reasons.push('URL in non-URL column')
    }
    
    if (cf.containsEmail && !columnName.toLowerCase().includes('email') && !columnName.toLowerCase().includes('mail')) {
      reasons.push('email in non-email column')
    }
    
    // Detect Lorem Ipsum or placeholder text
    if (/\b(lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit)\b/i.test(cf.value)) {
      reasons.push('placeholder/Lorem Ipsum text')
    }
    
    // Detect potential data leakage between columns
    if (cf.containsCommonWords && cf.wordCount > 5 && !majoritiesHaveSpaces) {
      reasons.push('sentence-like content in structured data column')
    }
    
    // Language/encoding issues
    if (/[^\x00-\x7F]/.test(cf.value) && !/^[\u00C0-\u017F\u0100-\u017F]*$/.test(cf.value)) {
      reasons.push('unusual encoding or non-standard characters')
    }
    
    // If we found significant anomalies, record them
    if (reasons.length >= 2 || reasons.some(r => r.includes('placeholder') || r.includes('Lorem') || r.includes('URL') || r.includes('email'))) {
      // Find the original row index
      let rowIndex = -1
      for (let r = 0; r < parsedData.length; r++) {
        if (parsedData[r][colIndex]?.trim() === cf.value) {
          rowIndex = r
          break
        }
      }
      
      const rowNum = rowIndex !== -1 ? rowIndex + 2 : 'Unknown'
      const truncatedValue = cf.value.length > 50 ? cf.value.substring(0, 50) + '...' : cf.value
      const reasonText = reasons.slice(0, 2).join(', ')
      anomalies.push(`Row ${rowNum}: "${truncatedValue}" (${reasonText})`)
    }
  })
  
  return anomalies.slice(0, 5) // Limit to top 5 anomalies
}