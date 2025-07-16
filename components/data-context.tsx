"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

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
}

// New interface for data history
interface DataHistory {
  fileData: FileData
  issues: DataIssue[]
  cleaningResult: CleaningResult
  timestamp: Date
}

interface DataContextType {
  // Clean Data state
  fileData: FileData | null
  setFileData: (data: FileData | null) => void
  originalFileData: FileData | null // Store original data
  setOriginalFileData: (data: FileData | null) => void
  issues: DataIssue[]
  setIssues: (issues: DataIssue[]) => void
  cleaningResults: CleaningResult[]
  setCleaningResults: (results: CleaningResult[]) => void
  dataQualityScore: number | null
  setDataQualityScore: (score: number | null) => void
  
  // History for undo functionality
  dataHistory: DataHistory[]
  setDataHistory: (history: DataHistory[]) => void
  
  // Shared state for other tabs
  uploadedFiles: FileData[]
  setUploadedFiles: (files: FileData[]) => void
  
  // Processing cancellation state
  currentAbortController: AbortController | null
  setCurrentAbortController: (controller: AbortController | null) => void
  
  // Computed properties for backwards compatibility
  fileId: string | null
  
  // Helper functions
  addCleaningResult: (result: CleaningResult) => void
  saveStateToHistory: (newFileData: FileData, newIssues: DataIssue[], result: CleaningResult) => void
  clearAllData: () => void
  resetForNewFile: () => void
  undoLastOperation: () => void
  cancelCurrentProcessing: () => void
  canUndo: boolean
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [fileData, setFileData] = useState<FileData | null>(null)
  const [originalFileData, setOriginalFileData] = useState<FileData | null>(null)
  const [issues, setIssues] = useState<DataIssue[]>([])
  const [cleaningResults, setCleaningResults] = useState<CleaningResult[]>([])
  const [dataQualityScore, setDataQualityScore] = useState<number | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([])
  const [dataHistory, setDataHistory] = useState<DataHistory[]>([])
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null)

  const addCleaningResult = (result: CleaningResult) => {
    setCleaningResults(prev => [...prev, result])
  }

  const saveStateToHistory = (newFileData: FileData, newIssues: DataIssue[], result: CleaningResult) => {
    // Save the state AFTER the operation is applied
    const historyEntry: DataHistory = {
      fileData: { ...newFileData },
      issues: [...newIssues],
      cleaningResult: result,
      timestamp: new Date()
    }
    setDataHistory(prev => [...prev, historyEntry])
  }

  const undoLastOperation = () => {
    if (dataHistory.length === 0) return
    
    // Remove the last operation from history
    const newHistory = [...dataHistory]
    newHistory.pop()
    setDataHistory(newHistory)
    
    // Remove the last cleaning result
    const newCleaningResults = [...cleaningResults]
    newCleaningResults.pop()
    setCleaningResults(newCleaningResults)
    
    // Restore to previous state
    if (newHistory.length > 0) {
      // Restore to the state from the previous operation
      const previousState = newHistory[newHistory.length - 1]
      setFileData(previousState.fileData)
      setIssues(previousState.issues)
    } else {
      // Restore to original data if no history left
      if (originalFileData) {
        setFileData(originalFileData)
        // Reset issues to unfixed state when going back to original
        setIssues(prev => prev.map(issue => ({
          ...issue,
          fixed: false,
          fixedBy: undefined,
          fixedAt: undefined
        })))
      }
    }
  }

  const clearAllData = async () => {
    // Cancel any ongoing processing first
    cancelCurrentProcessing()
    
    // Clear cached cleaned data on server
    if (fileData?.fileId) {
      try {
        await fetch('/api/ai/clear-cleaned-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileId: fileData.fileId
          }),
        })
      } catch (error) {
        console.error('Failed to clear server cache:', error)
      }
    }
    
    setFileData(null)
    setOriginalFileData(null)
    setIssues([])
    setCleaningResults([])
    setDataQualityScore(null)
    setDataHistory([])
  }

  const cancelCurrentProcessing = () => {
    // Cancel any ongoing processing
    if (currentAbortController) {
      currentAbortController.abort()
      setCurrentAbortController(null)
    }
  }

  const resetForNewFile = () => {
    // Cancel any ongoing processing first
    cancelCurrentProcessing()
    
    // Reset all cleaning state when a new file is uploaded
    setIssues([])
    setCleaningResults([])
    setDataQualityScore(null)
    setDataHistory([])
    // Note: fileData and originalFileData will be set by the upload handler
  }

  const canUndo = dataHistory.length > 0

  const value: DataContextType = {
    fileData,
    setFileData,
    originalFileData,
    setOriginalFileData,
    issues,
    setIssues,
    cleaningResults,
    setCleaningResults,
    dataQualityScore,
    setDataQualityScore,
    dataHistory,
    setDataHistory,
    uploadedFiles,
    setUploadedFiles,
    currentAbortController,
    setCurrentAbortController,
    fileId: fileData?.fileId || null,
    addCleaningResult,
    saveStateToHistory,
    clearAllData,
    resetForNewFile,
    undoLastOperation,
    cancelCurrentProcessing,
    canUndo,
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useDataContext() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider')
  }
  return context
} 