import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  Loader2
} from 'lucide-react'

interface RealMLDashboardProps {
  fileId: string
}

const RealMLDashboard = ({ fileId }: RealMLDashboardProps) => {
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/ai/comprehensive-quality-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }
      
      console.log('📊 Real ML Analysis Results:', data)
      setAnalysisData(data)
      
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Running Real ML Analysis...
          </CardTitle>
          <CardDescription>
            Using Great Expectations, Deequ, HoloClean, and Cleanlab
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Analyzing data with real ML models...</p>
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
            Real ML Data Quality Analysis
          </CardTitle>
          <CardDescription>
            Run comprehensive analysis using industry-standard ML tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
            <p className="text-gray-600 mb-4">
              Click below to run real ML analysis using Great Expectations, Deequ, HoloClean, and Cleanlab
            </p>
            <Button onClick={runAnalysis} className="bg-blue-600 hover:bg-blue-700">
              🧠 Run Real ML Analysis
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

  return (
    <div className="space-y-6">
      {/* ML Analysis Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">
              {isRealML ? '🧠 Real ML Data Quality Analysis' : '🔄 Basic Analysis (Fallback)'}
            </h2>
            <p className="text-blue-700">
              {isRealML 
                ? 'Powered by industry-standard ML tools for comprehensive data quality assessment' 
                : 'Real ML analysis unavailable, using basic detection methods'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-blue-900">✓</div>
            <div className="text-blue-700">Analysis Complete</div>
          </div>
        </div>
        
        {toolsUsed.length > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="text-sm font-medium text-blue-700 mb-2">Tools Used:</div>
            <div className="flex flex-wrap gap-2">
              {toolsUsed.map((tool: string, index: number) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Issues List */}
      {issues.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Detected Issues</h3>
          {issues.map((issue: any, index: number) => (
            <Card key={index} className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant={issue.severity === 'high' ? 'destructive' : issue.severity === 'medium' ? 'default' : 'secondary'}>
                        {issue.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium text-gray-600">
                        {issue.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {issue.tool && (
                        <Badge variant="outline" className="text-xs">
                          {issue.tool}
                        </Badge>
                      )}
                    </div>
                    
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {issue.description}
                    </h4>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                      {issue.ml_confidence && (
                        <span><strong>ML Confidence:</strong> {(issue.ml_confidence * 100).toFixed(1)}%</span>
                      )}
                      {issue.affected_columns && (
                        <span><strong>Columns:</strong> {issue.affected_columns.join(', ')}</span>
                      )}
                    </div>

                    {/* Examples */}
                    {issue.examples && issue.examples.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">Examples:</div>
                        <div className="bg-gray-50 rounded-lg p-3 text-sm font-mono space-y-1">
                          {issue.examples.slice(0, 3).map((example: string, idx: number) => (
                            <div key={idx} className="text-gray-700">
                              {example}
                            </div>
                          ))}
                          {issue.examples.length > 3 && (
                            <div className="text-gray-500 italic">
                              ... and {issue.examples.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ML Method */}
                    {issue.ml_method && (
                      <div className="mt-3 text-sm text-blue-600">
                        <strong>ML Method:</strong> {issue.ml_method}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-green-600 mb-4">
              <CheckCircle className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Issues Found!
            </h3>
            <p className="text-gray-600">
              {isRealML 
                ? 'Real ML analysis found no data quality issues in your dataset.' 
                : 'Basic analysis found no obvious issues.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Individual Tool Results */}
      {isRealML && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Great Expectations Results */}
          {analysis.great_expectations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Great Expectations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Expectations:</span>
                    <span className="font-semibold">{analysis.great_expectations.total_expectations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Passed:</span>
                    <span className="text-green-600 font-semibold">{analysis.great_expectations.passed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed:</span>
                    <span className="text-red-600 font-semibold">{analysis.great_expectations.failed}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Auto-generated expectations with ML profiling
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deequ Results */}
          {analysis.deequ && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">🏭</span>
                  Deequ (Amazon)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Constraints Generated:</span>
                    <span className="font-semibold">{analysis.deequ.constraints_generated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ML Anomalies:</span>
                    <span className="font-semibold">{Object.keys(analysis.deequ.ml_anomaly_detection || {}).length}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Large-scale data quality checks with Isolation Forest
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* HoloClean Results */}
          {analysis.holoclean && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">🔬</span>
                  HoloClean
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Errors Detected:</span>
                    <span className="font-semibold">{analysis.holoclean.errors_detected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Probabilistic:</span>
                    <span className="text-blue-600 font-semibold">
                      {analysis.holoclean.probabilistic_inference ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Probabilistic inference for error detection & repair
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cleanlab Results */}
          {analysis.cleanlab && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">🏷️</span>
                  Cleanlab
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Columns Analyzed:</span>
                    <span className="font-semibold">{analysis.cleanlab.columns_analyzed?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ML Powered:</span>
                    <span className="text-purple-600 font-semibold">
                      {analysis.cleanlab.ml_powered ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    ML-based mislabel detection for labeled data
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Run Again Button */}
      <div className="text-center pt-4">
        <Button onClick={runAnalysis} variant="outline" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Analysis...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Run Analysis Again
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default RealMLDashboard 