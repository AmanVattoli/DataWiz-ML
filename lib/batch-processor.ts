import { getCollection } from './mongodb'
import { cacheManager } from './cache'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

interface BatchJob {
  jobId: string
  fileId: string
  operation: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startTime: Date
  endTime?: Date
  results?: any
  error?: string
  chunkSize: number
  totalChunks: number
  processedChunks: number
  abortController?: AbortController
}

interface ChunkResult {
  chunkIndex: number
  data: any
  error?: string
}

export class BatchProcessor {
  private readonly CHUNK_SIZE = 10000 // Rows per chunk
  private readonly MAX_CONCURRENT_JOBS = 3
  private activeJobs: Map<string, BatchJob> = new Map()
  private activeProcesses: Map<string, any> = new Map() // Track Python processes

  // Cancel all jobs for a specific file
  async cancelJobsForFile(fileId: string): Promise<void> {
    const jobsToCancel = Array.from(this.activeJobs.values()).filter(job => job.fileId === fileId)
    
    for (const job of jobsToCancel) {
      await this.cancelJob(job.jobId)
    }
  }

  // Cancel a specific job
  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId)
    if (!job) return

    // Cancel the job
    job.status = 'cancelled'
    job.endTime = new Date()
    
    // Abort any HTTP requests
    if (job.abortController) {
      job.abortController.abort()
    }
    
    // Kill any active Python processes
    const processes = this.activeProcesses.get(jobId)
    if (processes) {
      if (Array.isArray(processes)) {
        processes.forEach(process => {
          if (process && !process.killed) {
            process.kill('SIGTERM')
          }
        })
      } else if (processes && !processes.killed) {
        processes.kill('SIGTERM')
      }
      this.activeProcesses.delete(jobId)
    }
    
    // Update job in database
    await this.saveJob(job)
    
    // Remove from active jobs
    this.activeJobs.delete(jobId)
  }

  // Process large dataset in chunks
  async processLargeDataset(
    fileId: string,
    fileContent: string,
    operation: string,
    options: any = {}
  ): Promise<string> {
    const jobId = `${fileId}_${operation}_${Date.now()}`
    const lines = fileContent.split('\n').filter(line => line.trim())
    const totalRows = lines.length - 1 // Exclude header
    const chunkSize = options.chunkSize || this.CHUNK_SIZE
    const totalChunks = Math.ceil(totalRows / chunkSize)

    // Create job record
    const abortController = new AbortController()
    const job: BatchJob = {
      jobId,
      fileId,
      operation,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      chunkSize,
      totalChunks,
      processedChunks: 0,
      abortController
    }

    // Store job in database
    await this.saveJob(job)
    this.activeJobs.set(jobId, job)

    // Start processing asynchronously
    this.processInBackground(jobId, fileContent, operation, options)

    return jobId
  }

  // Background processing
  private async processInBackground(
    jobId: string,
    fileContent: string,
    operation: string,
    options: any
  ): Promise<void> {
    const job = this.activeJobs.get(jobId)
    if (!job) return

    try {
      job.status = 'processing'
      await this.saveJob(job)

      const lines = fileContent.split('\n').filter(line => line.trim())
      const header = lines[0]
      const dataLines = lines.slice(1)
      
      const chunks = this.createChunks(dataLines, job.chunkSize)
      const results: ChunkResult[] = []

      // Process chunks concurrently
      const concurrentChunks = Math.min(this.MAX_CONCURRENT_JOBS, chunks.length)
      
      for (let i = 0; i < chunks.length; i += concurrentChunks) {
        // Check if job was cancelled
        if (job.status === 'cancelled') {
          console.log(`Job ${jobId} was cancelled, stopping processing`)
          return
        }

        const batch = chunks.slice(i, i + concurrentChunks)
        const batchPromises = batch.map((chunk, index) => 
          this.processChunk(header, chunk, operation, i + index, options, jobId)
        )

        try {
          const batchResults = await Promise.all(batchPromises)
          results.push(...batchResults)

          // Update progress
          job.processedChunks += batchResults.length
          job.progress = Math.round((job.processedChunks / job.totalChunks) * 100)
          await this.saveJob(job)
        } catch (error) {
          // If any chunk fails due to cancellation, stop processing
          if (error instanceof Error && error.message.includes('cancelled')) {
            console.log(`Job ${jobId} processing was cancelled`)
            return
          }
          throw error
        }
      }

      // Combine results
      const combinedResults = await this.combineResults(results, operation)
      
      // Complete job
      job.status = 'completed'
      job.endTime = new Date()
      job.results = combinedResults
      job.progress = 100
      
      await this.saveJob(job)
      
      // Cache final results
      await cacheManager.cacheMLAnalysis(job.fileId, fileContent, combinedResults, 7200)
      
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.endTime = new Date()
      await this.saveJob(job)
      console.error('Batch processing failed:', error)
    }
  }

  // Create data chunks
  private createChunks(dataLines: string[], chunkSize: number): string[][] {
    const chunks: string[][] = []
    for (let i = 0; i < dataLines.length; i += chunkSize) {
      chunks.push(dataLines.slice(i, i + chunkSize))
    }
    return chunks
  }

  // Process individual chunk
  private async processChunk(
    header: string,
    chunk: string[],
    operation: string,
    chunkIndex: number,
    options: any,
    jobId?: string
  ): Promise<ChunkResult> {
    try {
      const chunkCsv = [header, ...chunk].join('\n')
      
      // Check cache first
      const cacheKey = `chunk_${chunkIndex}_${operation}`
      const cached = await cacheManager.getCachedCleaning('chunk', cacheKey, chunkCsv)
      if (cached) {
        return { chunkIndex, data: cached }
      }

      // Process chunk based on operation
      let result: any
      switch (operation) {
        case 'ml_analysis':
          result = await this.processMLAnalysisChunk(chunkCsv, options, jobId)
          break
        case 'data_cleaning':
          result = await this.processCleaningChunk(chunkCsv, options)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      // Cache chunk result
      await cacheManager.cacheCleaning('chunk', cacheKey, chunkCsv, result, 3600)
      
      return { chunkIndex, data: result }
    } catch (error) {
      return { 
        chunkIndex, 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Process ML analysis chunk
  private async processMLAnalysisChunk(chunkCsv: string, options: any, jobId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(process.cwd(), 'temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      const tempFile = path.join(tempDir, `chunk_${Date.now()}.csv`)
      fs.writeFileSync(tempFile, chunkCsv)

      const pythonScript = path.join(process.cwd(), 'scripts', 'data_quality_analyzer.py')
      const python = spawn('python', [pythonScript, tempFile])

      // Track the process if jobId is provided
      if (jobId) {
        const existingProcesses = this.activeProcesses.get(jobId) || []
        const processes = Array.isArray(existingProcesses) ? existingProcesses : [existingProcesses]
        processes.push(python)
        this.activeProcesses.set(jobId, processes)
      }

      let stdout = ''
      let stderr = ''

      python.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      python.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      python.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile)
        } catch (e) {
          console.error('Failed to clean up temp file:', e)
        }

        // Remove from active processes
        if (jobId) {
          const processes = this.activeProcesses.get(jobId)
          if (Array.isArray(processes)) {
            const index = processes.indexOf(python)
            if (index > -1) {
              processes.splice(index, 1)
            }
            if (processes.length === 0) {
              this.activeProcesses.delete(jobId)
            }
          }
        }

        // Handle process termination
        if (code === null || python.killed) {
          reject(new Error('Process was cancelled'))
          return
        }

        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`))
          return
        }

        try {
          const jsonStartIndex = stdout.lastIndexOf('{')
          const jsonOutput = stdout.substring(jsonStartIndex)
          const results = JSON.parse(jsonOutput)
          resolve(results)
        } catch (error) {
          reject(new Error(`Failed to parse results: ${error}`))
        }
      })

      python.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`))
      })
    })
  }

  // Process cleaning chunk
  private async processCleaningChunk(chunkCsv: string, options: any): Promise<any> {
    // Implement your cleaning logic here
    // This is a simplified example
    const lines = chunkCsv.split('\n')
    const header = lines[0]
    const dataLines = lines.slice(1)
    
    // Simple cleaning example: remove empty lines
    const cleanedLines = dataLines.filter(line => line.trim())
    
    return {
      original_rows: dataLines.length,
      cleaned_rows: cleanedLines.length,
      cleaned_data: [header, ...cleanedLines].join('\n')
    }
  }

  // Combine chunk results
  private async combineResults(results: ChunkResult[], operation: string): Promise<any> {
    const successfulResults = results.filter(r => !r.error)
    const errors = results.filter(r => r.error)

    if (operation === 'ml_analysis') {
      // Combine ML analysis results
      const combinedIssues: any[] = []
      let totalRows = 0
      
      successfulResults.forEach(result => {
        if (result.data?.great_expectations_real?.expectations) {
          combinedIssues.push(...result.data.great_expectations_real.expectations)
        }
        if (result.data?.dataset_info?.rows) {
          totalRows += result.data.dataset_info.rows
        }
      })

      return {
        ml_comprehensive_analysis: {
          total_issues: combinedIssues.length,
          issues: combinedIssues,
          tools_used: ['Great Expectations', 'Deequ', 'HoloClean', 'Cleanlab'],
          real_ml: true,
          batch_processed: true,
          chunks_processed: successfulResults.length,
          errors: errors.length
        },
        dataset_info: {
          rows: totalRows,
          chunks: successfulResults.length
        }
      }
    } else {
      // Combine cleaning results
      const combinedData: string[] = []
      let totalOriginalRows = 0
      let totalCleanedRows = 0

      successfulResults.forEach(result => {
        if (result.data?.cleaned_data) {
          const lines = result.data.cleaned_data.split('\n')
          if (combinedData.length === 0) {
            combinedData.push(lines[0]) // Header
          }
          combinedData.push(...lines.slice(1)) // Data rows
        }
        totalOriginalRows += result.data?.original_rows || 0
        totalCleanedRows += result.data?.cleaned_rows || 0
      })

      return {
        cleaned_data: combinedData.join('\n'),
        original_rows: totalOriginalRows,
        cleaned_rows: totalCleanedRows,
        chunks_processed: successfulResults.length,
        errors: errors.length,
        batch_processed: true
      }
    }
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<BatchJob | null> {
    const job = this.activeJobs.get(jobId)
    if (job) return job

    // Check database
    const jobs = await getCollection('batch_jobs')
    const dbJob = await jobs.findOne({ jobId })
    
    if (dbJob) {
      this.activeJobs.set(jobId, dbJob)
      return dbJob
    }

    return null
  }

  // Save job to database
  private async saveJob(job: BatchJob): Promise<void> {
    const jobs = await getCollection('batch_jobs')
    await jobs.replaceOne({ jobId: job.jobId }, job, { upsert: true })
  }

  // Get all jobs for a user
  async getUserJobs(userId: string): Promise<BatchJob[]> {
    const jobs = await getCollection('batch_jobs')
    const userJobs = await jobs.find({ 
      fileId: { $regex: userId } 
    }).sort({ startTime: -1 }).toArray()
    
    return userJobs
  }

  // Clean up old jobs
  async cleanupOldJobs(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const jobs = await getCollection('batch_jobs')
    const cutoffDate = new Date(Date.now() - maxAge)
    
    await jobs.deleteMany({
      startTime: { $lt: cutoffDate },
      status: { $in: ['completed', 'failed'] }
    })
  }
}

export const batchProcessor = new BatchProcessor()
export default batchProcessor