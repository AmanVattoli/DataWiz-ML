"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileText, Trash2, AlertCircle, AlertTriangle, Columns, Search, Download, RefreshCw, Play, Eye, EyeOff, RotateCcw, BarChart, TrendingUp, Hash, CheckCircle, ChevronDown, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useDataContext } from "@/components/data-context"
import { DataViewer } from "@/components/data-viewer"
import ComprehensiveQualityDashboard from "@/components/comprehensive-quality-dashboard"

interface FileData {
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

interface CleaningResult {
  operation: string
  summary: string
  cleaned_data?: string
  [key: string]: any
}

interface DataIssue {
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  affected_columns: string[]
  count: number
  fixed?: boolean
  fixedBy?: string
  fixedAt?: Date
  examples?: string[]
  ignored?: boolean
  ignoredBy?: string
  ignoredAt?: Date
}

// Detection-only mode - no data modification state needed

export function CleanDataTab() {
  const {
    fileData,
    issues,
    setIssues,
    dataQualityScore,
    setDataQualityScore,
    clearAllData
  } = useDataContext()

  // Detection-only mode - minimal state for issue detection
  const [loading, setLoading] = useState(false)

  // Auto-detect issues when file is uploaded
  useEffect(() => {
    if (fileData && issues.length === 0) {
      detectIssues()
    }
  }, [fileData, issues.length])



  const shouldMarkIssueAsFixed = (issueType: string, operation: string): boolean => {
    const operationToIssueMap: { [key: string]: string[] } = {
      'remove_duplicates': ['duplicates'],
      'remove_column': ['nulls', 'missing_values', 'phone_format', 'inconsistent_phone_formats', 'phone_number_format', 'email_format', 'invalid_emails', 'date_format', 'inconsistent_dates', 'text_case', 'inconsistent_case', 'encoding_issues', 'special_characters', 'data_types', 'inconsistent_types', 'inconsistent_data_types', 'potential_mislabels', 'mislabeled_data', 'format', 'inconsistent_formatting', 'formatting', 'whitespace', 'whitespaces', 'leading_trailing_spaces'],
      'handle_nulls_fill': ['nulls', 'missing_values'],
      'handle_nulls_zero': ['nulls', 'missing_values'],
      'handle_nulls_drop': ['nulls', 'missing_values'],
      'handle_nulls_median': ['nulls', 'missing_values'],
      'handle_nulls_mean': ['nulls', 'missing_values'],
      'handle_nulls_mode': ['nulls', 'missing_values'],
      'handle_nulls_forward_fill': ['nulls', 'missing_values'],
      'handle_nulls_backward_fill': ['nulls', 'missing_values'],
      'handle_nulls_custom': ['nulls', 'missing_values'],
      'handle_nulls_interpolate': ['nulls', 'missing_values'],
      'standardize_phone_us': ['phone_format', 'inconsistent_phone_formats', 'phone_number_format'],
      'standardize_phone_dash': ['phone_format', 'inconsistent_phone_formats', 'phone_number_format'],
      'standardize_phone_dots': ['phone_format', 'inconsistent_phone_formats', 'phone_number_format'],
      'validate_phone_numbers': ['phone_format', 'inconsistent_phone_formats', 'phone_number_format'],
      'validate_emails': ['email_format', 'invalid_emails'],
      'standardize_email_case': ['email_format', 'invalid_emails'],
      'extract_email_domains': ['email_format', 'invalid_emails'],
      'standardize_dates_iso': ['date_format', 'inconsistent_dates'],
      'standardize_dates_us': ['date_format', 'inconsistent_dates'],
      'validate_dates': ['date_format', 'inconsistent_dates'],
      'extract_date_components': ['date_format', 'inconsistent_dates'],
      'standardize_case_title': ['text_case', 'inconsistent_case'],
      'standardize_case_upper': ['text_case', 'inconsistent_case'],
      'standardize_case_lower': ['text_case', 'inconsistent_case'],
      'standardize_case_sentence': ['text_case', 'inconsistent_case'],
      'fix_encoding': ['encoding_issues', 'special_characters'],
      'remove_special_chars': ['encoding_issues', 'special_characters'],
      'normalize_unicode': ['encoding_issues', 'special_characters'],
      'trim_whitespace': ['format', 'inconsistent_formatting', 'formatting', 'whitespace', 'whitespaces', 'leading_trailing_spaces'],
      'remove_extra_spaces': ['format', 'inconsistent_formatting', 'formatting', 'whitespace', 'whitespaces', 'leading_trailing_spaces'],
      'standardize_line_breaks': ['format', 'inconsistent_formatting', 'formatting'],
      'remove_tabs_newlines': ['whitespace', 'whitespaces', 'leading_trailing_spaces'],
      'fix_data_types': ['data_types', 'inconsistent_types', 'inconsistent_data_types'],
      'flag_mislabels': ['potential_mislabels', 'mislabeled_data'],
      'standardize_columns': ['naming', 'column_names'],
      'clean_column_names': ['naming', 'column_names'],
      'standardize_currency': ['currency_format', 'financial_data'],
      'remove_currency_symbols': ['currency_format', 'financial_data'],
      'standardize_addresses': ['address_format', 'inconsistent_addresses'],
      'extract_address_components': ['address_format', 'inconsistent_addresses'],
      'validate_zip_codes': ['address_format', 'inconsistent_addresses'],
      'handle_outliers_remove': ['outliers'],
      'handle_outliers_replace_median': ['outliers'],
      'smart_auto_fix': ['format', 'inconsistent_formatting', 'formatting', 'whitespace', 'data_types']
    }
    
    return operationToIssueMap[operation]?.includes(issueType) || false
  }



  const detectIssues = async () => {
    if (!fileData) return

    setLoading(true)
    // Clear existing issues to show fresh analysis
    setIssues([])
    try {
      const response = await fetch('/api/ai/clean-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          fileId: fileData.fileId,
          operation: 'detect_issues',
          columns: fileData.analysis.columns,
          timestamp: Date.now() // Add timestamp to bust cache
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to detect issues')
      }

      const result = await response.json()
      
      // Debug: Log the actual response to see the structure
      console.log('Full API Response:', result)
      console.log('API Response Issues:', result.issues || result.result?.issues)
      
              // Handle both direct issues and nested result structure
        const detectedIssues = result.issues || result.result?.issues
        if (detectedIssues) {
          // Preserve fixed status from existing issues
          const newIssues = detectedIssues.map((newIssue: DataIssue) => {
          const existingIssue = issues.find(existing => 
            existing.type === newIssue.type && 
            JSON.stringify(existing.affected_columns.sort()) === JSON.stringify(newIssue.affected_columns.sort())
          )
          
          if (existingIssue?.fixed) {
            return {
              ...newIssue,
              fixed: existingIssue.fixed,
              fixedBy: existingIssue.fixedBy,
              fixedAt: existingIssue.fixedAt
            }
          }
          
          return newIssue
        })
        
        setIssues(newIssues)
        setDataQualityScore(result.result?.summary?.data_quality_score || null)
        
        toast({
          title: "Data analysis complete",
          description: `Found ${detectedIssues.length} potential issues in your data.`,
        })
      }
    } catch (error) {
      console.error('Error detecting issues:', error)
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to analyze data quality.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }





  const downloadCleanedData = (result: any) => {
    if (!result.cleaned_data) {
      toast({
        title: "No cleaned data available",
        description: "This operation doesn't produce downloadable data.",
        variant: "destructive",
      })
      return
    }

    try {
      const blob = new Blob([result.cleaned_data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileData?.fileName?.replace('.csv', '')}_${result.operation}.csv` || `cleaned_data_${result.operation}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download started",
        description: "Your cleaned dataset is being downloaded.",
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download failed",
        description: "Failed to download the cleaned data.",
        variant: "destructive",
      })
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-600'
      case 'medium': return 'bg-orange-600'
      case 'low': return 'bg-yellow-600'
      default: return 'bg-gray-600'
    }
  }

  const getIssueTypeName = (type: string) => {
    switch (type) {
      case 'duplicates': return 'Duplicates'
      case 'nulls':
      case 'missing_values': return 'Missing Values'
      case 'inconsistent_formatting':
      case 'format': return 'Formatting'
      case 'outliers': return 'Outliers'
      case 'types':
      case 'data_types': return 'Data Types'
      case 'naming': return 'Column Names'
      default: return 'Unknown'
    }
  }

  const getIssueCategory = (type: string): string => {
    // Categorize issues into logical groups
    switch (type) {
      case 'duplicates':
        return 'Data Integrity'
      case 'nulls':
      case 'missing_values':
        return 'Missing Data'
      case 'phone_format':
      case 'inconsistent_phone_formats':
      case 'phone_number_format':
      case 'email_format':
      case 'invalid_emails':
      case 'date_format':
      case 'inconsistent_dates':
        return 'Format Validation'
      case 'inconsistent_formatting':
      case 'format':
      case 'whitespace':
      case 'whitespaces':
      case 'leading_trailing_spaces':
        return 'Text Formatting'
      case 'outliers':
        return 'Statistical Anomalies'
      case 'data_types':
      case 'types':
      case 'inconsistent_types':
      case 'inconsistent_data_types':
      case 'potential_mislabels':
      case 'mislabeled_data':
        return 'Data Type Issues'
      case 'column_names':
      case 'naming':
        return 'Schema Issues'
      case 'encoding_issues':
      case 'special_characters':
        return 'Encoding Issues'
      case 'currency_format':
      case 'financial_data':
      case 'address_format':
      case 'inconsistent_addresses':
        return 'Domain-Specific Formatting'
      default:
        return 'Data Type Issues' // Default everything to data type issues instead of "other"
    }
  }

  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'Data Integrity':
        return {
          icon: <Trash2 className="w-5 h-5" />,
          color: 'text-red-300',
          bgColor: 'bg-red-900/30',
          borderColor: 'border-red-600/50',
          description: 'Duplicate records and data consistency issues'
        }
      case 'Missing Data':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          color: 'text-orange-300',
          bgColor: 'bg-orange-900/30',
          borderColor: 'border-orange-600/50',
          description: 'Null values, empty fields, and incomplete records'
        }
      case 'Format Validation':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-blue-300',
          bgColor: 'bg-blue-900/30',
          borderColor: 'border-blue-600/50',
          description: 'Email, phone, date, and other format validation issues'
        }
      case 'Text Formatting':
        return {
          icon: <Columns className="w-5 h-5" />,
          color: 'text-cyan-300',
          bgColor: 'bg-cyan-900/30',
          borderColor: 'border-cyan-600/50',
          description: 'Whitespace, case inconsistencies, and text cleanup'
        }
      case 'Statistical Anomalies':
        return {
          icon: <BarChart className="w-5 h-5" />,
          color: 'text-purple-300',
          bgColor: 'bg-purple-900/30',
          borderColor: 'border-purple-600/50',
          description: 'Outliers and unusual data distributions'
        }
      case 'Data Type Issues':
        return {
          icon: <Hash className="w-5 h-5" />,
          color: 'text-green-300',
          bgColor: 'bg-green-900/30',
          borderColor: 'border-green-600/50',
          description: 'Type mismatches and semantic inconsistencies'
        }
      case 'Schema Issues':
        return {
          icon: <FileText className="w-5 h-5" />,
          color: 'text-indigo-300',
          bgColor: 'bg-indigo-900/30',
          borderColor: 'border-indigo-600/50',
          description: 'Column naming and structure problems'
        }
      case 'Encoding Issues':
        return {
          icon: <RefreshCw className="w-5 h-5" />,
          color: 'text-yellow-300',
          bgColor: 'bg-yellow-900/30',
          borderColor: 'border-yellow-600/50',
          description: 'Character encoding and special character problems'
        }
      case 'Domain-Specific Formatting':
        return {
          icon: <TrendingUp className="w-5 h-5" />,
          color: 'text-pink-300',
          bgColor: 'bg-pink-900/30',
          borderColor: 'border-pink-600/50',
          description: 'Currency, address, and domain-specific format issues'
        }
      default:
        return {
          icon: <Search className="w-5 h-5" />,
          color: 'text-gray-300',
          bgColor: 'bg-gray-900/30',
          borderColor: 'border-gray-600/50',
          description: 'Miscellaneous data quality issues'
        }
    }
  }

  const getIssueTypeInfo = (type: string) => {
    switch (type) {
      case 'duplicates':
        return {
          icon: <Trash2 className="w-4 h-4" />,
          color: 'bg-red-600',
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-600/30',
          textColor: 'text-red-300'
        }
      case 'nulls':
      case 'missing_values':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'bg-orange-600',
          bgColor: 'bg-orange-900/20',
          borderColor: 'border-orange-600/30',
          textColor: 'text-orange-300'
        }
      case 'inconsistent_formatting':
      case 'format':
        return {
          icon: <Columns className="w-4 h-4" />,
          color: 'bg-blue-600',
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-600/30',
          textColor: 'text-blue-300'
        }
      case 'outliers':
        return {
          icon: <BarChart className="w-4 h-4" />,
          color: 'bg-purple-600',
          bgColor: 'bg-purple-900/20',
          borderColor: 'border-purple-600/30',
          textColor: 'text-purple-300'
        }
      case 'types':
      case 'data_types':
        return {
          icon: <Hash className="w-4 h-4" />,
          color: 'bg-green-600',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-600/30',
          textColor: 'text-green-300'
        }
      case 'naming':
        return {
          icon: <FileText className="w-4 h-4" />,
          color: 'bg-indigo-600',
          bgColor: 'bg-indigo-900/20',
          borderColor: 'border-indigo-600/30',
          textColor: 'text-indigo-300'
        }
      default:
        return {
          icon: <Search className="w-4 h-4" />,
          color: 'bg-gray-600',
          bgColor: 'bg-gray-900/20',
          borderColor: 'border-gray-600/30',
          textColor: 'text-gray-300'
        }
    }
  }

  if (!fileData) {
    return (
      <div className="space-y-6">
        <Card className="rounded-lg shadow-lg border border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">No Data File Uploaded</CardTitle>
            <CardDescription className="text-gray-400">
              Please upload a CSV file using the upload area above to start cleaning and analyzing your data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-400">Upload a CSV file to get started with data cleaning</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Data Viewer - shown by default */}
      <DataViewer fileData={fileData} issues={issues} />

      {/* Comprehensive Quality Dashboard - ML Analysis */}
      {fileData && (
        <ComprehensiveQualityDashboard fileId={fileData.fileId} />
      )}

      {/* Data Issues Card */}
      {issues.length > 0 && (
        <Card className="rounded-lg shadow-lg border border-gray-700 bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Data Quality Issues</CardTitle>
                <CardDescription className="text-gray-400">
                  {`${issues.length} issues detected in your dataset`}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {dataQualityScore !== null && (
                  <Badge variant="secondary" className={`${
                    dataQualityScore >= 80 ? 'bg-green-600' : 
                    dataQualityScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                  } text-white`}>
                    Quality: {dataQualityScore}%
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Issue Type Legend */}
            <div className="mb-6 p-3 rounded-lg bg-gray-900/30 border border-gray-600">
              <h5 className="text-sm font-medium text-gray-300 mb-2">Issue Types:</h5>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-red-600 flex items-center justify-center">
                    <Trash2 className="w-2 h-2 text-white" />
                  </div>
                  <span className="text-red-300">Duplicates</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-orange-600 flex items-center justify-center">
                    <AlertCircle className="w-2 h-2 text-white" />
                  </div>
                  <span className="text-orange-300">Missing Values</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-blue-600 flex items-center justify-center">
                    <Columns className="w-2 h-2 text-white" />
                  </div>
                  <span className="text-blue-300">Formatting</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-purple-600 flex items-center justify-center">
                    <BarChart className="w-2 h-2 text-white" />
                  </div>
                  <span className="text-purple-300">Outliers</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-green-600 flex items-center justify-center">
                    <Hash className="w-2 h-2 text-white" />
                  </div>
                  <span className="text-green-300">Data Types</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-indigo-600 flex items-center justify-center">
                    <FileText className="w-2 h-2 text-white" />
                  </div>
                  <span className="text-indigo-300">Column Names</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
                             {(() => {
                 // Group issues by category
                 const filteredIssues = issues
                 const groupedIssues = filteredIssues.reduce((groups, issue) => {
                  const category = getIssueCategory(issue.type)
                  if (!groups[category]) {
                    groups[category] = []
                  }
                  groups[category].push(issue)
                  return groups
                }, {} as { [key: string]: DataIssue[] })

                // Sort categories by priority (most critical first)
                const categoryOrder = [
                  'Data Integrity',
                  'Missing Data', 
                  'Data Type Issues',
                  'Statistical Anomalies',
                  'Format Validation',
                  'Text Formatting',
                  'Schema Issues',
                  'Encoding Issues',
                  'Domain-Specific Formatting'
                ]

                return categoryOrder.map(category => {
                  const categoryIssues = groupedIssues[category]
                  if (!categoryIssues || categoryIssues.length === 0) return null

                  const categoryInfo = getCategoryInfo(category)
                  const categoryActiveIssues = categoryIssues.filter(issue => !issue.ignored).length
                  const categoryIgnoredIssues = categoryIssues.filter(issue => issue.ignored).length

                  return (
                    <div key={category} className={`rounded-lg ${categoryInfo.bgColor} border ${categoryInfo.borderColor} p-4`}>
                      {/* Category Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center ${categoryInfo.color}`}>
                            {categoryInfo.icon}
                          </div>
                          <div>
                            <h3 className={`text-lg font-semibold ${categoryInfo.color}`}>
                              {category}
                            </h3>
                            <p className="text-sm text-gray-400">
                              {categoryInfo.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className={`${categoryInfo.color} bg-gray-800/50 border-0`}>
                            {categoryActiveIssues} {categoryActiveIssues === 1 ? 'issue' : 'issues'}
                          </Badge>
                          {categoryIgnoredIssues > 0 && (
                            <Badge variant="secondary" className="bg-gray-600 text-gray-300 border-0">
                              {categoryIgnoredIssues} ignored
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Issues in this category */}
                      <div className="space-y-3">
                        {categoryIssues.map((issue, index) => {
                          const originalIndex = issues.findIndex(originalIssue => originalIssue === issue)


                const typeInfo = getIssueTypeInfo(issue.type)
                
                return (
                  <div key={originalIndex} className={`p-4 rounded-lg ${typeInfo.bgColor} border ${typeInfo.borderColor} ${issue.ignored ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`w-8 h-8 rounded-lg ${typeInfo.color} flex items-center justify-center flex-shrink-0 text-white`}>
                          {typeInfo.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className={`font-medium ${issue.fixed ? 'text-gray-500 line-through' : typeInfo.textColor}`}>{issue.description}</h4>
                            <div className="flex items-center space-x-1">
                              <Badge variant="secondary" className={`text-xs ${typeInfo.color} text-white border-0`}>
                                {getIssueTypeName(issue.type)}
                              </Badge>
                              <Badge variant="secondary" className={`text-xs ${getSeverityColor(issue.severity)} text-white border-0`}>
                                {issue.severity}
                              </Badge>
                              {issue.fixed && (
                                <Badge variant="secondary" className="text-xs bg-green-600 text-white border-0">
                                  ✓ Fixed
                                </Badge>
                              )}
                              {issue.ignored && (
                                <Badge variant="secondary" className="text-xs bg-gray-600 text-white border-0">
                                  👁️ Ignored
                                </Badge>
                              )}
                            </div>
                          </div>

                          {issue.affected_columns.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {issue.affected_columns.map((col, colIndex) => (
                                <Badge key={colIndex} variant="outline" className={`text-xs ${typeInfo.borderColor} ${typeInfo.textColor} bg-transparent`}>
                                  {col}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {issue.examples && issue.examples.length > 0 && (
                            <div className="mt-3 p-3 rounded-lg bg-gray-900/40 border border-gray-600/30">
                              <h6 className="text-xs font-medium text-gray-300 mb-2">Examples:</h6>
                              <div className="space-y-1">
                                {issue.examples.slice(0, 3).map((example: string, exampleIndex: number) => (
                                  <div key={exampleIndex} className="text-xs text-gray-400 font-mono bg-gray-800/50 px-2 py-1 rounded border">
                                    {example}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Issue severity badge */}
                      <div className="flex items-center ml-4">
                        <Badge variant="secondary" className={`${getSeverityColor(issue.severity)} text-white border-0`}>
                          {issue.severity.toUpperCase()} SEVERITY
                        </Badge>
                            </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )
                }).filter(Boolean) // Remove null entries
              })()}
            </div>
            
            {loading && (
              <div className="mt-4 flex items-center justify-center space-x-2 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing data quality...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}




    </div>
  )
}
