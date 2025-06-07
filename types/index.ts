export interface ColorInfo {
  rgb: {
    r: number
    g: number
    b: number
  }
  hex: string
  hsl: {
    h: number
    s: number
    l: number
  }
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  mediaRecorder: MediaRecorder | null
  stream: MediaStream | null
}

export interface ZoomState {
  level: number
  isActive: boolean
}

export interface ScreenshotOptions {
  format: 'png' | 'jpeg'
  quality?: number
}

export interface ExtensionMessage {
  type: 'CAPTURE_SCREENSHOT' | 'START_RECORDING' | 'STOP_RECORDING' | 'TOGGLE_COLOR_PICKER' | 'SET_ZOOM' | 'RESET_ZOOM'
  payload?: any
}

export interface TabInfo {
  id: number
  url: string
  title: string
}

export type ToolType = 'recorder' | 'capture' | 'colorPicker' | 'zoom'
