"use client"

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Upload, File, X, AlertCircle, CheckCircle, Database, Search, Zap } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useDataContext } from '@/components/data-context'

interface FileUploadProps {
  onFileUploaded: (fileData: any) => void
  accept?: string[]
}

interface UploadedFile {
  fileId: string
  fileName: string
  analysis: any
}

type ProcessingStage = 'uploading' | 'parsing' | 'analyzing' | 'complete'

interface ProcessingStageInfo {
  label: string
  description: string
  icon: React.ReactNode
  progress: number
}

export function FileUpload({ onFileUploaded, accept = ['.csv'] }: FileUploadProps) {
  const { currentAbortController, setCurrentAbortController } = useDataContext()
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('uploading')
  const [progress, setProgress] = useState(0)

  const getStageInfo = (stage: ProcessingStage): ProcessingStageInfo => {
    switch (stage) {
      case 'uploading':
        return {
          label: 'Uploading File',
          description: 'Securely transferring your CSV file...',
          icon: <Upload className="w-4 h-4" />,
          progress: 25
        }
      case 'parsing':
        return {
          label: 'Parsing Data',
          description: 'Reading and validating CSV structure...',
          icon: <Database className="w-4 h-4" />,
          progress: 50
        }
      case 'analyzing':
        return {
          label: 'Analyzing Content',
          description: 'Detecting data types and generating insights...',
          icon: <Search className="w-4 h-4" />,
          progress: 75
        }
      case 'complete':
        return {
          label: 'Processing Complete',
          description: 'Your data is ready for cleaning and analysis!',
          icon: <CheckCircle className="w-4 h-4" />,
          progress: 100
        }
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      })
      return
    }



    // Cancel any ongoing processing first
    if (currentAbortController) {
      currentAbortController.abort()
    }

    setUploading(true)
    setProcessingStage('uploading')
    setProgress(0)

    // Create new abort controller for this upload
    const abortController = new AbortController()
    setCurrentAbortController(abortController)

    try {
      // Stage 1: Uploading
      setProcessingStage('uploading')
      setProgress(25)
      
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      // Stage 2: Parsing
      setProcessingStage('parsing')
      setProgress(50)
      
      // Add a small delay to show the parsing stage
      await new Promise(resolve => setTimeout(resolve, 500))

      const result = await response.json()
      
      // Stage 3: Analyzing
      setProcessingStage('analyzing')
      setProgress(75)
      
      // Add a small delay to show the analyzing stage
      await new Promise(resolve => setTimeout(resolve, 800))

      // Stage 4: Complete
      setProcessingStage('complete')
      setProgress(100)
      
      setUploadedFile({
        fileId: result.fileId,
        fileName: result.fileName,
        analysis: result.analysis
      })

      onFileUploaded(result)

      // Show completion for a moment before clearing
      setTimeout(() => {
        toast({
          title: "🎉 File processed successfully!",
          description: `${result.fileName} is ready for data cleaning and analysis. Found ${result.analysis.totalRows} rows and ${result.analysis.totalColumns} columns.`,
        })
      }, 500)

    } catch (error) {
      // Don't show error if request was aborted (user uploaded new file)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Upload cancelled by user')
        return
      }
      
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      setProgress(0)
      // Clear abort controller when upload is complete
      if (currentAbortController === abortController) {
        setCurrentAbortController(null)
      }
    }
      }, [onFileUploaded, session, status, currentAbortController, setCurrentAbortController])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': accept
    },
    maxFiles: 1,
    disabled: uploading || status === 'loading'
  })

  const removeFile = () => {
    setUploadedFile(null)
  }

  if (uploadedFile) {
    return (
      <Card className="border border-gray-700 bg-gray-800 animate-in fade-in-50 duration-500">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-medium">{uploadedFile.fileName}</h3>
                <p className="text-gray-400 text-sm">
                  {uploadedFile.analysis.totalRows} rows • {uploadedFile.analysis.totalColumns} columns
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={removeFile}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-blue-400 font-medium">{uploadedFile.analysis.totalRows}</div>
              <div className="text-gray-500">Rows</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-medium">{uploadedFile.analysis.totalColumns}</div>
              <div className="text-gray-500">Columns</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-medium">
                {uploadedFile.analysis.dataTypes.filter((type: string) => type === 'numeric').length}
              </div>
              <div className="text-gray-500">Numeric</div>
            </div>
            <div className="text-center">
              <div className="text-orange-400 font-medium">
                {uploadedFile.analysis.dataTypes.filter((type: string) => type === 'text').length}
              </div>
              <div className="text-gray-500">Text</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-gray-700 bg-gray-800">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-400 bg-blue-400/10' 
              : 'border-gray-600 hover:border-gray-500'
            }
            ${uploading ? 'cursor-not-allowed opacity-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center space-y-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isDragActive ? 'bg-blue-600' : 'bg-gray-700'
            }`}>
              {uploading || status === 'loading' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-gray-300" />
              )}
            </div>

            <div className="w-full max-w-md">
              <h3 className="text-white font-medium mb-2 text-center">
                {status === 'loading' 
                  ? 'Loading...' 
                  : uploading 
                  ? getStageInfo(processingStage).label
                  : isDragActive 
                  ? 'Drop your file here' 
                  : 'Upload CSV File'
                }
              </h3>
              <p className="text-gray-400 text-sm text-center mb-4">
                {status === 'loading' 
                  ? 'Initializing session...'
                  : uploading 
                  ? getStageInfo(processingStage).description
                  : `Drag and drop your CSV file here, or click to browse.`
                }
              </p>

              {uploading && (
                <div className="space-y-4">
                  <Progress 
                    value={progress} 
                    className="w-full h-2 bg-gray-700"
                  />
                  
                  {/* Processing stages visualization */}
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {(['uploading', 'parsing', 'analyzing'] as ProcessingStage[]).map((stage, index) => {
                      const stageInfo = getStageInfo(stage)
                      const isActive = processingStage === stage
                      const isComplete = ['uploading', 'parsing', 'analyzing'].indexOf(processingStage) > index
                      
                      return (
                        <div 
                          key={stage}
                          className={`flex items-center space-x-2 p-2 rounded transition-colors ${
                            isActive 
                              ? 'bg-blue-600/20 border border-blue-600/30' 
                              : isComplete 
                              ? 'bg-green-600/20 border border-green-600/30'
                              : 'bg-gray-700/30 border border-gray-600/30'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            isComplete 
                              ? 'bg-green-600' 
                              : isActive 
                              ? 'bg-blue-600' 
                              : 'bg-gray-600'
                          }`}>
                            {isComplete ? (
                              <CheckCircle className="w-3 h-3 text-white" />
                            ) : isActive ? (
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            ) : (
                              <div className="w-2 h-2 bg-gray-400 rounded-full" />
                            )}
                          </div>
                          <span className={`font-medium ${
                            isActive 
                              ? 'text-blue-300' 
                              : isComplete 
                              ? 'text-green-300'
                              : 'text-gray-400'
                          }`}>
                            {stageInfo.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-300">
                    {getStageInfo(processingStage).icon}
                    <span>{progress}% Complete</span>
                  </div>
                </div>
              )}
            </div>

            {!uploading && status !== 'loading' && (
              <Button
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <File className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center space-x-2 text-xs text-gray-500">
          <AlertCircle className="w-4 h-4" />
          <span>Supported format: CSV files only. Your data is processed securely and cached temporarily.</span>
        </div>
      </CardContent>
    </Card>
  )
} 