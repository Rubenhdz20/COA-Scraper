export interface ProcessingJob {
  documentId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  error?: string
}

class ProcessingQueue {
  private jobs = new Map<string, ProcessingJob>()
  private isProcessing = false

  async addJob(documentId: string): Promise<void> {
    this.jobs.set(documentId, {
      documentId,
      status: 'queued'
    })

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processNext()
    }
  }

  private async processNext(): Promise<void> {
    this.isProcessing = true

    while (this.jobs.size > 0) {
      // Find next queued job
      const queuedJob = Array.from(this.jobs.values()).find(job => job.status === 'queued')
      
      if (!queuedJob) {
        break
      }

      // Update job status
      queuedJob.status = 'processing'
      queuedJob.startedAt = new Date()

      try {
        // Call the processing API
        const response = await fetch(`/api/process/${queuedJob.documentId}`, {
          method: 'POST'
        })

        if (response.ok) {
          queuedJob.status = 'completed'
          queuedJob.completedAt = new Date()
        } else {
          const errorData = await response.json()
          queuedJob.status = 'failed'
          queuedJob.error = errorData.error || 'Processing failed'
          queuedJob.completedAt = new Date()
        }
      } catch (error) {
        queuedJob.status = 'failed'
        queuedJob.error = error instanceof Error ? error.message : 'Unknown error'
        queuedJob.completedAt = new Date()
      }

      // Clean up completed jobs after 5 minutes
      setTimeout(() => {
        this.jobs.delete(queuedJob.documentId)
      }, 5 * 60 * 1000)
    }

    this.isProcessing = false
  }

  getJobStatus(documentId: string): ProcessingJob | null {
    return this.jobs.get(documentId) || null
  }

  getAllJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values())
  }

  removeJob(documentId: string): boolean {
    return this.jobs.delete(documentId)
  }
}

// Singleton instance
let processingQueueInstance: ProcessingQueue | null = null

export function getProcessingQueue(): ProcessingQueue {
  if (!processingQueueInstance) {
    processingQueueInstance = new ProcessingQueue()
  }
  return processingQueueInstance
}

// Client-side processing trigger
export async function triggerProcessing(documentId: string): Promise<{
  success: boolean
  message: string
  status?: string
}> {
  try {
    const response = await fetch(`/api/process/${documentId}`, {
      method: 'POST'
    })

    const data = await response.json()

    if (response.ok) {
      return {
        success: true,
        message: data.message || 'Processing completed successfully',
        status: 'completed'
      }
    } else {
      return {
        success: false,
        message: data.error || 'Processing failed',
        status: 'failed'
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
      status: 'failed'
    }
  }
}

// Polling utility for processing status
export async function pollProcessingStatus(
  documentId: string,
  onStatusUpdate: (status: string, data?: any) => void,
  maxAttempts: number = 30,
  intervalMs: number = 2000
): Promise<void> {
  let attempts = 0

  const poll = async () => {
    try {
      const response = await fetch(`/api/process/${documentId}`)
      const data = await response.json()

      if (response.ok && data.success) {
        const status = data.data.processingStatus
        onStatusUpdate(status, data.data)

        if (status === 'completed' || status === 'failed') {
          return // Stop polling
        }
      }

      attempts++
      if (attempts < maxAttempts) {
        setTimeout(poll, intervalMs)
      } else {
        onStatusUpdate('timeout')
      }
    } catch (error) {
      console.error('Polling error:', error)
      onStatusUpdate('error', error)
    }
  }

  poll()
}