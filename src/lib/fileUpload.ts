export interface UploadResponse {
  success: boolean
  data?: {
    id: string
    filename: string
    originalName: string
    fileSize: number
    uploadedAt: string
  }
  error?: string
  details?: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          }
          onProgress(progress)
        }
      })
    }

    // Handle completion
    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText)
        
        if (xhr.status === 200 && response.success) {
          resolve(response)
        } else {
          resolve({
            success: false,
            error: response.error || 'Upload failed',
            details: response.details
          })
        }
      } catch (error) {
        resolve({
          success: false,
          error: 'Invalid response from server'
        })
      }
    })

    // Handle errors
    xhr.addEventListener('error', () => {
      resolve({
        success: false,
        error: 'Network error during upload'
      })
    })

    // Handle timeout
    xhr.addEventListener('timeout', () => {
      resolve({
        success: false,
        error: 'Upload timeout'
      })
    })

    // Configure and send request
    xhr.timeout = 60000 // 60 second timeout
    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  })
}

export async function getDocumentStatus(documentId: string) {
  try {
    const response = await fetch(`/api/documents/${documentId}`)
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch document status')
    }
    
    return data
  } catch (error) {
    console.error('Error fetching document status:', error)
    throw error
  }
}

export async function deleteDocument(documentId: string) {
  try {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: 'DELETE'
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete document')
    }
    
    return data
  } catch (error) {
    console.error('Error deleting document:', error)
    throw error
  }
}