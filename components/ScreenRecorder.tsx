import { useEffect, useRef, useState } from "react"

import type { RecordingState } from "~types"
import {
  downloadBlob,
  formatDuration,
  getDisplayMedia
} from "~utils/mediaUtils"

export default function ScreenRecorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    mediaRecorder: null,
    stream: null
  })

  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (recordingState.stream) {
        recordingState.stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      setError("")
      setStatus("Requesting screen access...")

      // Request screen capture permission from background script
      const response = await chrome.runtime.sendMessage({
        type: "START_RECORDING"
      })

      if (!response.success) {
        throw new Error(response.error || "Failed to get screen access")
      }

      // Get the stream using the streamId from background
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: response.streamId
          }
        } as any,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: response.streamId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 30
          }
        } as any
      })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9"
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
        downloadBlob(blob, `screen-recording-${timestamp}.webm`)
        setStatus("Recording saved!")

        setTimeout(() => setStatus(""), 3000)
      }

      mediaRecorder.start(1000) // Collect data every second

      setRecordingState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        mediaRecorder,
        stream
      })

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecordingState((prev) => ({
          ...prev,
          duration: prev.duration + 1
        }))
      }, 1000)

      setStatus("Recording started!")

      // Listen for stream end (user stops sharing)
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopRecording()
      })
    } catch (error) {
      console.error("Recording start error:", error)
      setError(error.message || "Failed to start recording")
    }
  }

  const pauseRecording = () => {
    if (recordingState.mediaRecorder && recordingState.isRecording) {
      if (recordingState.isPaused) {
        recordingState.mediaRecorder.resume()
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(() => {
          setRecordingState((prev) => ({
            ...prev,
            duration: prev.duration + 1
          }))
        }, 1000)
        setStatus("Recording resumed")
      } else {
        recordingState.mediaRecorder.pause()
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setStatus("Recording paused")
      }

      setRecordingState((prev) => ({
        ...prev,
        isPaused: !prev.isPaused
      }))
    }
  }

  const stopRecording = () => {
    if (recordingState.mediaRecorder) {
      recordingState.mediaRecorder.stop()
    }

    if (recordingState.stream) {
      recordingState.stream.getTracks().forEach((track) => track.stop())
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      mediaRecorder: null,
      stream: null
    })

    setStatus("Recording stopped")
  }

  return (
    <div className="tool-section">
      <h3>🎥 Screen Recording</h3>

      {error && <div className="status-message status-error">{error}</div>}

      {status && <div className="status-message status-info">{status}</div>}

      {recordingState.isRecording && (
        <div className="recording-status">
          <div className="recording-indicator">
            <div className="recording-dot"></div>
            <span>{recordingState.isPaused ? "Paused" : "Recording"}</span>
          </div>
          <div className="duration">
            {formatDuration(recordingState.duration)}
          </div>
        </div>
      )}

      <div className="recording-controls">
        {!recordingState.isRecording ? (
          <button className="btn btn-primary" onClick={startRecording}>
            <span>🎬</span>
            Start Recording
          </button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={pauseRecording}>
              <span>{recordingState.isPaused ? "▶️" : "⏸️"}</span>
              {recordingState.isPaused ? "Resume" : "Pause"}
            </button>

            <button className="btn btn-danger" onClick={stopRecording}>
              <span>⏹️</span>
              Stop Recording
            </button>
          </>
        )}
      </div>

      <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "16px" }}>
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul style={{ paddingLeft: "16px", margin: "8px 0" }}>
          <li>Click "Start Recording" to begin</li>
          <li>Select the screen/window to record</li>
          <li>Use pause/resume as needed</li>
          <li>Click "Stop" to finish and download</li>
        </ul>
      </div>
    </div>
  )
}
