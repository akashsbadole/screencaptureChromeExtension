// Documentation Service - Real Implementation for SOP Creation and Knowledge Management

export interface SOPData {
  id: string
  title: string
  description: string
  steps: SOPStep[]
  screenshots: Screenshot[]
  createdAt: string
  updatedAt: string
  tags: string[]
  category: string
}

export interface SOPStep {
  id: string
  stepNumber: number
  title: string
  description: string
  screenshot?: string
  notes?: string
  estimatedTime?: number
}

export interface Screenshot {
  id: string
  stepId?: string
  url: string
  timestamp: string
  description?: string
}

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  url: string
  tags: string[]
  createdAt: string
  category: string
  screenshots: string[]
}

class DocumentationService {
  private storageKey = 'multiToolPro_documentation'
  
  // SOP Creation Functions
  async createSOP(title: string, description: string): Promise<SOPData> {
    const sop: SOPData = {
      id: this.generateId(),
      title,
      description,
      steps: [],
      screenshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      category: 'general'
    }
    
    await this.saveSOP(sop)
    return sop
  }
  
  async addStepToSOP(sopId: string, stepData: Omit<SOPStep, 'id' | 'stepNumber'>): Promise<SOPStep> {
    const sops = await this.getAllSOPs()
    const sop = sops.find(s => s.id === sopId)
    
    if (!sop) throw new Error('SOP not found')
    
    const step: SOPStep = {
      id: this.generateId(),
      stepNumber: sop.steps.length + 1,
      ...stepData
    }
    
    sop.steps.push(step)
    sop.updatedAt = new Date().toISOString()
    
    await this.saveSOP(sop)
    return step
  }
  
  async captureScreenshotForStep(sopId: string, stepId: string): Promise<Screenshot> {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab || !tab.id) throw new Error('No active tab')
      
      // Capture screenshot using Chrome API
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 90
      })
      
      const screenshot: Screenshot = {
        id: this.generateId(),
        stepId,
        url: dataUrl,
        timestamp: new Date().toISOString(),
        description: `Screenshot for step ${stepId}`
      }
      
      // Save screenshot to SOP
      const sops = await this.getAllSOPs()
      const sop = sops.find(s => s.id === sopId)
      if (sop) {
        sop.screenshots.push(screenshot)
        const step = sop.steps.find(s => s.id === stepId)
        if (step) {
          step.screenshot = dataUrl
        }
        await this.saveSOP(sop)
      }
      
      return screenshot
    } catch (error) {
      console.error('Screenshot capture failed:', error)
      throw error
    }
  }
  
  // Knowledge Management Functions
  async captureKnowledge(title: string, content: string, tags: string[] = []): Promise<KnowledgeItem> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    const knowledge: KnowledgeItem = {
      id: this.generateId(),
      title,
      content,
      url: tab?.url || '',
      tags,
      createdAt: new Date().toISOString(),
      category: 'general',
      screenshots: []
    }
    
    await this.saveKnowledge(knowledge)
    return knowledge
  }
  
  async searchKnowledge(query: string): Promise<KnowledgeItem[]> {
    const allKnowledge = await this.getAllKnowledge()
    const lowercaseQuery = query.toLowerCase()
    
    return allKnowledge.filter(item => 
      item.title.toLowerCase().includes(lowercaseQuery) ||
      item.content.toLowerCase().includes(lowercaseQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    )
  }
  
  // PDF Generation Functions
  async generateSOPPDF(sopId: string): Promise<Blob> {
    const sop = await this.getSOPById(sopId)
    if (!sop) throw new Error('SOP not found')
    
    // Create HTML content for PDF
    const htmlContent = this.generateSOPHTML(sop)
    
    // Convert to PDF (simplified version - in real implementation would use jsPDF)
    const blob = new Blob([htmlContent], { type: 'text/html' })
    return blob
  }
  
  private generateSOPHTML(sop: SOPData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${sop.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .step { margin-bottom: 20px; padding: 15px; border-left: 4px solid #667eea; background: #f9f9f9; }
          .step-number { font-weight: bold; color: #667eea; font-size: 18px; }
          .screenshot { max-width: 100%; margin: 10px 0; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${sop.title}</h1>
          <p>${sop.description}</p>
          <p><strong>Created:</strong> ${new Date(sop.createdAt).toLocaleDateString()}</p>
        </div>
        
        <div class="steps">
          ${sop.steps.map(step => `
            <div class="step">
              <div class="step-number">Step ${step.stepNumber}: ${step.title}</div>
              <p>${step.description}</p>
              ${step.screenshot ? `<img src="${step.screenshot}" class="screenshot" alt="Step ${step.stepNumber} screenshot">` : ''}
              ${step.notes ? `<p><strong>Notes:</strong> ${step.notes}</p>` : ''}
            </div>
          `).join('')}
        </div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
          Generated by Multi-Tool Pro Extension on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `
  }
  
  // Storage Functions
  private async saveSOP(sop: SOPData): Promise<void> {
    const sops = await this.getAllSOPs()
    const existingIndex = sops.findIndex(s => s.id === sop.id)
    
    if (existingIndex >= 0) {
      sops[existingIndex] = sop
    } else {
      sops.push(sop)
    }
    
    await chrome.storage.local.set({ [`${this.storageKey}_sops`]: sops })
  }
  
  private async saveKnowledge(knowledge: KnowledgeItem): Promise<void> {
    const items = await this.getAllKnowledge()
    const existingIndex = items.findIndex(k => k.id === knowledge.id)
    
    if (existingIndex >= 0) {
      items[existingIndex] = knowledge
    } else {
      items.push(knowledge)
    }
    
    await chrome.storage.local.set({ [`${this.storageKey}_knowledge`]: items })
  }
  
  async getAllSOPs(): Promise<SOPData[]> {
    const result = await chrome.storage.local.get([`${this.storageKey}_sops`])
    return result[`${this.storageKey}_sops`] || []
  }
  
  async getAllKnowledge(): Promise<KnowledgeItem[]> {
    const result = await chrome.storage.local.get([`${this.storageKey}_knowledge`])
    return result[`${this.storageKey}_knowledge`] || []
  }
  
  async getSOPById(id: string): Promise<SOPData | null> {
    const sops = await this.getAllSOPs()
    return sops.find(sop => sop.id === id) || null
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
  
  // Time Tracking Functions
  async trackDocumentationTime(activity: string, timeSpent: number): Promise<void> {
    const timeData = await this.getTimeTracking()
    const today = new Date().toDateString()
    
    if (!timeData[today]) {
      timeData[today] = {}
    }
    
    if (!timeData[today][activity]) {
      timeData[today][activity] = 0
    }
    
    timeData[today][activity] += timeSpent
    
    await chrome.storage.local.set({ [`${this.storageKey}_time`]: timeData })
  }
  
  async getTimeTracking(): Promise<Record<string, Record<string, number>>> {
    const result = await chrome.storage.local.get([`${this.storageKey}_time`])
    return result[`${this.storageKey}_time`] || {}
  }
}

export const documentationService = new DocumentationService()
