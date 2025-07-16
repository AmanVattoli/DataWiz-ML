"use client"

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table2, Download, Search, Filter, MoreHorizontal, Upload, AlertTriangle, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { useDataContext } from '@/components/data-context'

interface DataIssue {
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  affected_columns: string[]
  count: number
}

interface DataViewerProps {
  fileData: {
    fileId: string
    fileName: string
    analysis: {
      totalRows: number
      totalColumns: number
      columns: string[]
      sampleData: any[]
      dataTypes: string[]
    }
  }
  issues?: DataIssue[]
  onClose?: () => void
}

export function DataViewer({ fileData, issues = [], onClose }: DataViewerProps) {
  const { clearAllData } = useDataContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [filteredData, setFilteredData] = useState(fileData.analysis.sampleData)
  // Removed filtering states - detection-only mode
  const tableRef = useRef<HTMLDivElement>(null)

  // Function to check if a cell has data quality issues
  const getCellIssues = (rowIndex: number, columnName: string, value: any) => {
    const cellIssues: { type: string; severity: string; description: string }[] = []
    
    if (!issues || issues.length === 0 || !fileData?.analysis?.sampleData || !fileData?.analysis?.columns) return cellIssues
    
    issues.forEach(issue => {
      if (issue.affected_columns && issue.affected_columns.includes(columnName)) {
        // Only check for certain, objective issues
        switch (issue.type) {
          case 'missing_values':
          case 'nulls':
            // Certain: value is definitively missing/null
            if (value === null || value === undefined || value === '' || value === 'null' || value === 'NULL' || value === 'N/A') {
              cellIssues.push({
                type: 'missing',
                severity: 'high',
                description: 'Missing value'
              })
            }
            break
          case 'duplicates':
            // Certain: row is an exact duplicate
            const currentRow = fileData.analysis.sampleData[rowIndex]
            if (currentRow && fileData.analysis.columns) {
              const isDuplicate = fileData.analysis.sampleData.some((otherRow, otherIndex) => {
                if (otherIndex === rowIndex || !otherRow) return false
                return fileData.analysis.columns.every(col => 
                  String(currentRow[col] || '') === String(otherRow[col] || '')
                )
              })
              if (isDuplicate) {
                cellIssues.push({
                  type: 'duplicate',
                  severity: 'high',
                  description: 'Duplicate row'
                })
              }
            }
            break
          case 'inconsistent_formatting':
          case 'format':
            // Certain: definitive formatting issues
            if (typeof value === 'string' && value !== '') {
              if (value.trim() !== value) {
                cellIssues.push({
                  type: 'whitespace',
                  severity: 'medium',
                  description: 'Leading/trailing whitespace'
                })
              }
              if (value.includes('  ')) {
                cellIssues.push({
                  type: 'spacing',
                  severity: 'medium',
                  description: 'Multiple consecutive spaces'
                })
              }
            }
            break
          // Remove subjective outlier detection and data type guessing
          // Only keep certain, objective issues
        }
      }
    })

    // Fallback: Only for certain, objective issues
    if (cellIssues.length === 0) {
      issues.forEach(issue => {
        if (issue.affected_columns && issue.affected_columns.includes(columnName)) {
          // Only handle certain issues in fallback
          if (issue.type === 'duplicates') {
            const currentRow = fileData.analysis.sampleData[rowIndex]
            if (currentRow && fileData.analysis.columns) {
              const isDuplicate = fileData.analysis.sampleData.some((otherRow, otherIndex) => {
                if (otherIndex === rowIndex || !otherRow) return false
                return fileData.analysis.columns.every(col => 
                  String(currentRow[col] || '') === String(otherRow[col] || '')
                )
              })
              if (isDuplicate) {
                cellIssues.push({
                  type: 'duplicate',
                  severity: 'high',
                  description: 'Part of duplicate row'
                })
              }
            }
          }
          else if ((issue.type === 'nulls' || issue.type === 'missing_values') && 
                   (value === null || value === undefined || value === '' || value === 'null' || value === 'NULL' || value === 'N/A')) {
            cellIssues.push({
              type: 'missing',
              severity: 'high',
              description: 'Missing or null value'
            })
          }
        }
      })
    }

    return cellIssues
  }

  // Function to get cell styling based on issues
  const getCellStyling = (cellIssues: any[]) => {
    if (cellIssues.length === 0) return ''
    
    const highSeverity = cellIssues.some(issue => issue.severity === 'high')
    const mediumSeverity = cellIssues.some(issue => issue.severity === 'medium')
    
    if (highSeverity) {
      return 'bg-red-500/20 border-red-500/50 text-red-200'
    } else if (mediumSeverity) {
      return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200'
    } else {
      return 'bg-orange-500/20 border-orange-500/50 text-orange-200'
    }
  }

  // Function to get issue icon
  const getIssueIcon = (issueType: string) => {
    switch (issueType) {
      case 'missing':
        return '⚠️'
      case 'duplicate':
        return '👥'
      case 'whitespace':
        return '🔤'
      case 'spacing':
        return '📏'
      case 'type_mismatch':
        return '🔢'
      case 'outlier':
        return '📊'
      case 'naming':
        return '🏷️'
      default:
        return '❗'
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault()
            const searchInput = document.querySelector('input[placeholder="Search data..."]') as HTMLInputElement
            searchInput?.focus()
            break
          case 'c':
            if (selectedColumn && selectedRow !== null) {
              e.preventDefault()
              const cellValue = String(filteredData[selectedRow]?.[selectedColumn] || '')
              navigator.clipboard.writeText(cellValue)
              toast({
                title: "Copied to clipboard",
                description: `Cell value: ${cellValue}`,
              })
            }
            break
        }
      }
      
      // Arrow key navigation
      if (selectedRow !== null && selectedColumn) {
        const columns = fileData.analysis.columns
        const currentColIndex = columns.indexOf(selectedColumn)
        
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault()
            if (selectedRow > 0) {
              setSelectedRow(selectedRow - 1)
            }
            break
          case 'ArrowDown':
            e.preventDefault()
            if (selectedRow < filteredData.length - 1) {
              setSelectedRow(selectedRow + 1)
            }
            break
          case 'ArrowLeft':
            e.preventDefault()
            if (currentColIndex > 0) {
              setSelectedColumn(columns[currentColIndex - 1])
            }
            break
          case 'ArrowRight':
            e.preventDefault()
            if (currentColIndex < columns.length - 1) {
              setSelectedColumn(columns[currentColIndex + 1])
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedRow, selectedColumn, filteredData, fileData.analysis.columns])

  // Get unique issue types from detected issues
  const getUniqueIssueTypes = () => {
    const issueTypes = new Set<string>()
    issues.forEach(issue => {
      issueTypes.add(issue.type)
    })
    return Array.from(issueTypes)
  }

  // Get user-friendly name for issue type
  const getIssueTypeName = (type: string) => {
    switch (type) {
      case 'missing_values':
      case 'nulls':
        return 'Missing Values'
      case 'duplicates':
        return 'Duplicates'
      case 'phone_format':
      case 'inconsistent_phone_formats':
      case 'phone_number_format':
        return 'Phone Format'
      case 'email_format':
      case 'invalid_emails':
        return 'Email Format'
      case 'date_format':
      case 'inconsistent_dates':
        return 'Date Format'
      case 'text_case':
      case 'inconsistent_case':
        return 'Text Case'
      case 'encoding_issues':
      case 'special_characters':
        return 'Encoding Issues'
      case 'whitespace':
      case 'whitespaces':
      case 'leading_trailing_spaces':
        return 'Whitespace'
      case 'format':
      case 'inconsistent_formatting':
      case 'formatting':
        return 'Formatting'
      case 'data_types':
      case 'inconsistent_types':
      case 'inconsistent_data_types':
        return 'Data Types'
      case 'potential_mislabels':
      case 'mislabeled_data':
        return 'Potential Mislabels'
      case 'column_names':
      case 'naming':
        return 'Column Names'
      case 'currency_format':
      case 'financial_data':
        return 'Currency Format'
      case 'address_format':
      case 'inconsistent_addresses':
        return 'Address Format'
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  // Check if a row has a specific issue type
  const rowHasIssueType = (rowIndex: number, issueTypeToCheck: string) => {
    if (!fileData.analysis.columns) return false
    
    return fileData.analysis.columns.some(column => {
      const cellIssues = getCellIssues(rowIndex, column, fileData.analysis.sampleData[rowIndex][column])
      
      // Check if any cell issues match the selected issue type
      return cellIssues.some(cellIssue => {
        // Map cell issue types back to main issue types
        const mainIssueTypes = issues
          .filter(issue => issue.affected_columns.includes(column))
          .map(issue => issue.type)
        
        return mainIssueTypes.includes(issueTypeToCheck)
      })
    })
  }

  // Filter data based on search term and issue filter
  useEffect(() => {
    if (!fileData?.analysis?.sampleData || !Array.isArray(fileData.analysis.sampleData)) {
      setFilteredData([])
      return
    }

    let filtered = fileData.analysis.sampleData

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false
        return Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }

    // No filtering - show all data for detection-only mode

    setFilteredData(filtered)
  }, [searchTerm, fileData?.analysis?.sampleData])

  const handleCellClick = (rowIndex: number, columnName: string) => {
    setSelectedRow(rowIndex)
    setSelectedColumn(columnName)
  }

  const getColumnWidth = (columnName: string) => {
    // Calculate optimal width based on content
    const maxLength = Math.max(
      columnName.length,
      ...filteredData.slice(0, 20).map(row => 
        String(row[columnName] || '').length
      )
    )
    return Math.min(Math.max(maxLength * 8 + 32, 120), 300)
  }

  const downloadData = async () => {
    try {
      // Convert data to CSV
      const headers = fileData.analysis.columns.join(',')
      const rows = filteredData.map(row =>
        fileData.analysis.columns.map(col => {
          const value = row[col] || ''
          // Escape commas and quotes in CSV
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value
        }).join(',')
      ).join('\n')
      
      const csvContent = `${headers}\n${rows}`
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileData.fileName.replace('.csv', '')}_filtered.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "Data exported",
        description: `${filteredData.length} rows exported to CSV`,
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export data",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="rounded-lg shadow-lg border border-gray-700 bg-gray-800 h-[60vh] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Table2 className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle className="text-xl text-white">{fileData.fileName}</CardTitle>
              <CardDescription className="text-gray-400">
                Showing {filteredData.length} of {fileData.analysis.totalRows} rows • {fileData.analysis.totalColumns} columns
                {issues.length > 0 && (
                  <span className="ml-2 text-orange-400">
                    • Quality issues detected
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllData}
              className="border-blue-600 text-blue-300 hover:bg-blue-900/20"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload New File
            </Button>
          </div>
        </div>
        
        {/* Search Controls */}
        <div className="flex items-center space-x-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
          <div className="flex items-center space-x-2">
            {selectedColumn && (
              <Badge variant="secondary" className="bg-blue-600 text-white">
                Column: {selectedColumn}
              </Badge>
            )}
            {selectedRow !== null && (
              <Badge variant="secondary" className="bg-green-600 text-white">
                Row: {selectedRow + 1}
              </Badge>
            )}
          </div>
        </div>

        {/* Issue Legend */}
        {issues.length > 0 && (
          <div className="flex items-center space-x-4 mt-2 text-xs">
            <span className="text-gray-500">Hover cells for details</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div 
          ref={tableRef}
          className="h-full overflow-auto bg-gray-900 border border-gray-700 rounded-lg"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-600">
              <div className="flex">
                {/* Row number header */}
                <div className="w-16 flex-shrink-0 px-3 py-2 text-center text-xs font-medium text-gray-400 bg-gray-700 border-r border-gray-600">
                  #
                </div>
                {/* Column headers */}
                {fileData.analysis.columns.map((column, index) => (
                  <div
                    key={column}
                    className={`px-3 py-2 text-left text-xs font-medium text-gray-300 border-r border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors ${
                      selectedColumn === column ? 'bg-blue-600/20 text-blue-300' : ''
                    }`}
                    style={{ minWidth: getColumnWidth(column), width: getColumnWidth(column) }}
                    onClick={() => setSelectedColumn(selectedColumn === column ? null : column)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{column}</span>
                      <Badge 
                        variant="outline" 
                        className="ml-2 text-xs border-gray-500 text-gray-400"
                      >
                        {fileData.analysis.dataTypes[index]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Rows */}
            <div>
              {filteredData.map((row, rowIndex) => {
                if (!row || typeof row !== 'object') {
                  return null
                }
                return (
                <div 
                  key={rowIndex}
                  className={`flex border-b border-gray-700 hover:bg-gray-800/50 transition-colors ${
                    selectedRow === rowIndex ? 'bg-green-600/10' : ''
                  }`}
                >
                  {/* Row number */}
                  <div 
                    className={`w-16 flex-shrink-0 px-3 py-2 text-center text-xs text-gray-400 bg-gray-800/50 border-r border-gray-600 cursor-pointer hover:bg-gray-700 ${
                      selectedRow === rowIndex ? 'bg-green-600/20 text-green-300' : ''
                    }`}
                    onClick={() => setSelectedRow(selectedRow === rowIndex ? null : rowIndex)}
                  >
                    {rowIndex + 1}
                  </div>
                                                       {/* Data cells */}
                  {fileData.analysis.columns.map((column) => {
                    const cellIssues = getCellIssues(rowIndex, column, row[column])
                    const cellStyling = getCellStyling(cellIssues)
                    const hasIssues = cellIssues.length > 0
                    
                    // Build className with proper priority
                    let className = 'px-3 py-2 text-sm border-r border-gray-700 cursor-pointer hover:bg-gray-700/50 transition-colors relative'
                    
                    if (hasIssues) {
                      // Apply issue styling first (highest priority)
                      className += ` ${cellStyling}`
                    } else {
                      // Apply selection styling only if no issues
                      if (selectedColumn === column && selectedRow === rowIndex) {
                        className += ' bg-blue-600/30 text-blue-200'
                      } else if (selectedColumn === column) {
                        className += ' bg-blue-600/10'
                      } else if (selectedRow === rowIndex) {
                        className += ' bg-green-600/10'
                      }
                    }
                    
                    return (
                      <div
                        key={`${rowIndex}-${column}`}
                        className={className}
                        style={{ minWidth: getColumnWidth(column), width: getColumnWidth(column) }}
                        onClick={() => handleCellClick(rowIndex, column)}
                        title={hasIssues 
                          ? `${String(row[column] || '')}\n\nIssues:\n${cellIssues.map(issue => `• ${issue.description}`).join('\n')}`
                          : String(row[column] || '')
                        }
                      >
                         <div className="truncate relative">
                           {hasIssues && (
                             <span className="absolute -top-1 -right-1 text-xs">
                               {getIssueIcon(cellIssues[0].type)}
                             </span>
                           )}
                           <span className={hasIssues ? 'pr-4' : ''}>
                             {row[column] !== null && row[column] !== undefined && row[column] !== '' ? 
                               String(row[column]) : 
                               <span className="text-gray-500 italic">null</span>
                             }
                           </span>
                         </div>
                       </div>
                     )
                   })}
                </div>
                )
              })}
            </div>

            {/* Empty state */}
            {filteredData.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-2">No data found</div>
                <div className="text-gray-500 text-sm">
                  {searchTerm ? 'Try adjusting your search terms' : 'No data available'}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Footer with stats */}
      <div className="flex-shrink-0 px-6 py-3 bg-gray-800/50 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Rows: {filteredData.length.toLocaleString()}</span>
            <span>Columns: {fileData.analysis.totalColumns}</span>
            {issues.length > 0 && (
              <span className="text-orange-300">
                Issues detected
              </span>
            )}
            {selectedColumn && selectedRow !== null && (
              <span className="text-blue-300">
                Selected: {selectedColumn} = {String(filteredData[selectedRow]?.[selectedColumn] || 'null')}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {issues.length > 0 ? 'Red/Yellow/Orange cells indicate detected issues • ' : ''}Scroll to view more data • Click cells to select • Use search to find specific data
          </div>
        </div>
      </div>
    </Card>
  )
} 