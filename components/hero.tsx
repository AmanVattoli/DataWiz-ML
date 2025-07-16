import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, File, CheckCircle, Database, Search } from "lucide-react"
import { useDataContext } from "@/components/data-context"
import { toast } from "@/hooks/use-toast"

interface HeroProps {
  onUploadClick?: () => void
}

type ProcessingStage = 'uploading' | 'parsing' | 'analyzing' | 'complete'

interface ProcessingStageInfo {
  label: string
  description: string
  icon: React.ReactNode
  progress: number
}

export function Hero({ onUploadClick }: HeroProps) {
  const { data: session, status } = useSession()
  const { fileData, setFileData, setOriginalFileData, resetForNewFile, currentAbortController, setCurrentAbortController } = useDataContext()
  const [uploading, setUploading] = useState(false)
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('uploading')
  const [progress, setProgress] = useState(0)
  const [showUploadInterface, setShowUploadInterface] = useState(true)

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
                            description: 'Your data is ready for quality analysis!',
          icon: <CheckCircle className="w-4 h-4" />,
          progress: 100
        }
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    // Check if session is ready
    if (status === 'loading') {
      toast({
        title: "Please wait",
        description: "Loading session, please try again in a moment.",
        variant: "default",
      })
      return
    }

    if (status === 'unauthenticated') {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload files.",
        variant: "destructive",
      })
      return
    }

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

    // Reset all state for new file
    resetForNewFile()
    
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
      
      // Update global context with new file data
      const newFileData = {
        fileId: result.fileId,
        fileName: result.fileName,
        analysis: result.analysis
      }
      setFileData(newFileData)
      setOriginalFileData(newFileData)

      // Hide upload interface after successful upload
      setShowUploadInterface(false)

      // Show completion for a moment before clearing
      setTimeout(() => {
        toast({
          title: "🎉 File processed successfully!",
          description: `${result.fileName} is ready for quality analysis. Found ${result.analysis.totalRows} rows and ${result.analysis.totalColumns} columns.`,
        })
      }, 500)

      // Navigate to quality analysis interface
      if (onUploadClick) {
        onUploadClick()
      }

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
      }, [setFileData, setOriginalFileData, resetForNewFile, onUploadClick, session, status, currentAbortController, setCurrentAbortController, setShowUploadInterface])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: uploading || status === 'loading',
    noClick: true // We'll handle click on the button
  })

  const handleButtonClick = () => {
    // Check session before opening file dialog
    if (status === 'loading') {
      toast({
        title: "Please wait",
        description: "Loading session, please try again in a moment.",
        variant: "default",
      })
      return
    }

    if (status === 'unauthenticated') {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload files.",
        variant: "destructive",
      })
      return
    }

    // Cancel any ongoing processing before opening file dialog
    if (currentAbortController) {
      currentAbortController.abort()
      console.log('Cancelled previous processing via Choose File button')
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files.length > 0) {
        onDrop([files[0]])
      }
    }
    input.click()
  }

  const handleUploadNewFile = () => {
    // Show upload interface again
    setShowUploadInterface(true)
    // Clear current file data
    setFileData(null)
    setOriginalFileData(null)
    // Reset for new file
    resetForNewFile()
  }

  return (
    <section className="relative py-20 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="absolute inset-0 bg-[url('/placeholder.svg')] opacity-5"></div>
      
      <div className="container mx-auto text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            ML-Powered
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 block">
              Data Quality Detection
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            Detect and analyze data quality issues in your datasets with advanced ML algorithms.
          </p>

          {showUploadInterface && !fileData ? (
            <>
              <div
                {...getRootProps()}
                className={`
                  max-w-md mx-auto p-8 border-2 border-dashed rounded-xl transition-all duration-300 mb-6
                  ${isDragActive 
                    ? 'border-blue-400 bg-blue-400/10 scale-105' 
                    : 'border-gray-600 hover:border-gray-500'
                  }
                  ${uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                `}
              >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isDragActive ? 'bg-blue-600' : (uploading || status === 'loading') ? 'bg-gray-700' : 'bg-gray-800'
              }`}>
                {uploading || status === 'loading' ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-300" />
                )}
              </div>

              <div className="w-full">
                <h3 className="text-white font-semibold text-lg mb-2">
                  {status === 'loading' ? 'Loading...' : uploading ? getStageInfo(processingStage).label : isDragActive ? 'Drop your CSV file here' : 'Upload CSV File'}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {status === 'loading' 
                    ? 'Initializing session...'
                    : uploading 
                    ? getStageInfo(processingStage).description
                    : 'Drag and drop your CSV file here, or click the button below.'
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
            </div>
          </div>

            <Button
              size="lg"
              onClick={handleButtonClick}
              disabled={uploading || status === 'loading'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            >
              <File className="w-5 h-5 mr-2" />
              {status === 'loading' ? 'Loading...' : uploading ? 'Uploading...' : 'Choose File'}
            </Button>

              <p className="text-xs text-gray-500 mt-4">
                Supported format: CSV files only.
              </p>
            </>
          ) : (
            // Show file uploaded state with "Upload New File" button
            <div className="max-w-md mx-auto">
              <div className="p-8 border-2 border-green-600 bg-green-600/10 rounded-xl mb-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-white font-semibold text-lg mb-2">File Uploaded Successfully!</h3>
                    <p className="text-gray-300 text-sm mb-2">
                      {fileData?.fileName}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {fileData?.analysis.totalRows} rows • {fileData?.analysis.totalColumns} columns
                    </p>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleUploadNewFile}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload New File
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
