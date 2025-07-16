import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  Search,
  Target,
  TrendingUp,
  Loader2
} from 'lucide-react'
import { useDataContext } from '@/components/data-context'

interface ComprehensiveQualityDashboardProps {
  fileId: string
}

const ComprehensiveQualityDashboard = ({ fileId }: ComprehensiveQualityDashboardProps) => {
  const { currentAbortController, setCurrentAbortController } = useDataContext()
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-trigger analysis when component mounts
  useEffect(() => {
    if (fileId && !analysisData && !loading) {
      runAnalysis()
    }
  }, [fileId])

  const runAnalysis = async () => {
    // Cancel any previous analysis
    if (currentAbortController) {
      currentAbortController.abort()
    }

    // Create new abort controller for this analysis
    const abortController = new AbortController()
    setCurrentAbortController(abortController)
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/ai/comprehensive-quality-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
        signal: abortController.signal
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }
      
      console.log('Real ML Analysis Results:', data)
      setAnalysisData(data)
      
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Analysis cancelled by user')
        return
      }
      
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
      // Clear abort controller when analysis is complete
      if (currentAbortController === abortController) {
        setCurrentAbortController(null)
      }
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Analyzing Your Data...
          </CardTitle>
          <CardDescription>
            Scanning your data for quality issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600 mb-2">Analyzing your data...</p>
              <p className="text-sm text-gray-500">Large files may take several minutes to process</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Analysis Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={runAnalysis} className="mt-4">
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!analysisData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Data Quality Analysis
          </CardTitle>
          <CardDescription>
            Analyze your data to identify quality issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
            <p className="text-gray-600 mb-4">
              Click below to analyze your data for quality issues
            </p>
            <Button onClick={runAnalysis} className="bg-blue-600 hover:bg-blue-700">
              Analyze Data Quality
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { analysis } = analysisData
  const isRealML = analysis.ml_comprehensive_analysis?.real_ml
  const toolsUsed = analysis.ml_comprehensive_analysis?.tools_used || []
  const issues = analysis.ml_comprehensive_analysis?.issues || []

  // Just run the analysis silently in the background
  // The actual issue detection and display is handled by the clean-data-tab component
  return null
}

export default ComprehensiveQualityDashboard 