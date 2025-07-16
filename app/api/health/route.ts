import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'

export async function GET() {
  try {
    // Check database connection
    const collection = await getCollection('system_info')
    await collection.findOne({})
    
    // Check Python availability
    const pythonAvailable = await checkPythonAvailability()
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: 'connected',
        python: pythonAvailable ? 'available' : 'unavailable',
        nodejs: 'running'
      },
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}

async function checkPythonAvailability(): Promise<boolean> {
  try {
    const { spawn } = require('child_process')
    
    return new Promise((resolve) => {
      const python = spawn('python3', ['--version'])
      
      python.on('close', (code: number) => {
        resolve(code === 0)
      })
      
      python.on('error', () => {
        resolve(false)
      })
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000)
    })
  } catch {
    return false
  }
}