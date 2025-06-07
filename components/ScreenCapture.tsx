import { useState } from "react"

import type { ExtensionMessage, ScreenshotOptions } from "~types"
import { dataURLtoBlob, downloadBlob } from "~utils/mediaUtils"

export default function ScreenCapture() {
  const [screenshot, setScreenshot] = useState<string>("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [format, setFormat] = useState<"png" | "jpeg">("png")
  const [quality, setQuality] = useState(100)

  const captureScreenshot = async () => {
    try {
      setIsCapturing(true)
      setError("")
      setStatus("Capturing screenshot...")

      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!tab || !tab.id) {
        throw new Error("No active tab found")
      }

      // Capture the visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: format,
        quality: format === "jpeg" ? quality : undefined
      })

      setScreenshot(dataUrl)
      setStatus("Screenshot captured!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error) {
      console.error("Screenshot error:", error)
      setError(error.message || "Failed to capture screenshot")
    } finally {
      setIsCapturing(false)
    }
  }

  const downloadScreenshot = () => {
    if (screenshot) {
      const blob = dataURLtoBlob(screenshot)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const extension = format === "png" ? "png" : "jpg"
      downloadBlob(blob, `screenshot-${timestamp}.${extension}`)
      setStatus("Screenshot downloaded!")
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const copyToClipboard = async () => {
    if (screenshot) {
      try {
        const blob = dataURLtoBlob(screenshot)
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ])
        setStatus("Screenshot copied to clipboard!")
        setTimeout(() => setStatus(""), 3000)
      } catch (error) {
        console.error("Copy error:", error)
        setError("Failed to copy to clipboard")
      }
    }
  }

  const clearScreenshot = () => {
    setScreenshot("")
    setStatus("")
    setError("")
  }

  return (
    <div className="tool-section">
      <h3>📸 Screen Capture</h3>

      {error && <div className="status-message status-error">{error}</div>}

      {status && <div className="status-message status-success">{status}</div>}

      {/* Format Options */}
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "12px",
            fontWeight: "500"
          }}>
          Format:
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px"
            }}>
            <input
              type="radio"
              value="png"
              checked={format === "png"}
              onChange={(e) => setFormat(e.target.value as "png")}
            />
            PNG (Lossless)
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px"
            }}>
            <input
              type="radio"
              value="jpeg"
              checked={format === "jpeg"}
              onChange={(e) => setFormat(e.target.value as "jpeg")}
            />
            JPEG (Smaller)
          </label>
        </div>
      </div>

      {/* Quality Slider for JPEG */}
      {format === "jpeg" && (
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "12px",
              fontWeight: "500"
            }}>
            Quality: {quality}%
          </label>
          <input
            type="range"
            min="10"
            max="100"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Capture Button */}
      <button
        className="btn btn-primary"
        onClick={captureScreenshot}
        disabled={isCapturing}>
        <span>📷</span>
        {isCapturing ? "Capturing..." : "Capture Screenshot"}
      </button>

      {/* Screenshot Preview */}
      {screenshot && (
        <div style={{ marginTop: "16px" }}>
          <img
            src={screenshot}
            alt="Screenshot preview"
            className="screenshot-preview"
          />

          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              className="btn btn-success"
              onClick={downloadScreenshot}
              style={{ flex: 1 }}>
              <span>💾</span>
              Download
            </button>

            <button
              className="btn btn-secondary"
              onClick={copyToClipboard}
              style={{ flex: 1 }}>
              <span>📋</span>
              Copy
            </button>

            <button
              className="btn btn-danger"
              onClick={clearScreenshot}
              style={{ flex: 1 }}>
              <span>🗑️</span>
              Clear
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "16px" }}>
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul style={{ paddingLeft: "16px", margin: "8px 0" }}>
          <li>Choose format (PNG for quality, JPEG for size)</li>
          <li>Adjust quality for JPEG if needed</li>
          <li>Click "Capture Screenshot" to take a screenshot</li>
          <li>Download, copy, or clear the result</li>
        </ul>
      </div>
    </div>
  )
}
