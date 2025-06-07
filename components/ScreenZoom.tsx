import { useState } from "react"

export default function ScreenZoom() {
  const [currentZoom, setCurrentZoom] = useState(100)
  const [isActive, setIsActive] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")

  const zoomLevels = [50, 75, 100, 125, 150, 200]

  const setZoom = async (zoomLevel: number) => {
    try {
      setError("")

      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!tab || !tab.id) {
        throw new Error("No active tab found")
      }

      // Inject zoom script directly into the page
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (zoomLevel) => {
          const body = document.body
          if (zoomLevel === 100) {
            // Reset zoom
            body.style.transform = ""
            body.style.transformOrigin = ""
            body.style.width = ""
            body.style.height = ""
          } else {
            // Apply zoom
            const scale = zoomLevel / 100
            body.style.transform = `scale(${scale})`
            body.style.transformOrigin = "top left"
            body.style.width = `${100 / scale}%`
            body.style.height = `${100 / scale}%`
          }
        },
        args: [zoomLevel]
      })

      setCurrentZoom(zoomLevel)
      setIsActive(zoomLevel !== 100)
      setStatus(`Zoom set to ${zoomLevel}%`)
      setTimeout(() => setStatus(""), 2000)
    } catch (error) {
      console.error("Zoom error:", error)
      setError(error.message || "Failed to set zoom")
    }
  }

  const resetZoom = async () => {
    await setZoom(100)
  }

  const adjustZoom = (delta: number) => {
    const newZoom = Math.max(25, Math.min(400, currentZoom + delta))
    setZoom(newZoom)
  }

  return (
    <div className="tool-section">
      <h3>🔍 Screen Zoom</h3>

      {error && <div className="status-message status-error">{error}</div>}

      {status && <div className="status-message status-success">{status}</div>}

      {/* Current Zoom Display */}
      <div className="zoom-display">
        {currentZoom}%
        {isActive && (
          <span style={{ fontSize: "12px", color: "#28a745" }}> (Active)</span>
        )}
      </div>

      {/* Quick Zoom Buttons */}
      <div className="zoom-controls">
        {zoomLevels.map((level) => (
          <button
            key={level}
            className={`zoom-btn ${currentZoom === level ? "active" : ""}`}
            onClick={() => setZoom(level)}>
            {level}%
          </button>
        ))}
      </div>

      {/* Zoom Slider */}
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "12px",
            fontWeight: "500"
          }}>
          Custom Zoom: {currentZoom}%
        </label>
        <input
          type="range"
          min="25"
          max="400"
          step="5"
          value={currentZoom}
          onChange={(e) => setZoom(parseInt(e.target.value))}
          className="zoom-slider"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10px",
            color: "#6c757d",
            marginTop: "4px"
          }}>
          <span>25%</span>
          <span>100%</span>
          <span>400%</span>
        </div>
      </div>

      {/* Zoom Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          marginBottom: "16px"
        }}>
        <button
          className="btn btn-secondary"
          onClick={() => adjustZoom(-25)}
          disabled={currentZoom <= 25}>
          <span>🔍➖</span>
          Zoom Out
        </button>

        <button
          className="btn btn-primary"
          onClick={resetZoom}
          disabled={currentZoom === 100}>
          <span>🎯</span>
          Reset
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => adjustZoom(25)}
          disabled={currentZoom >= 400}>
          <span>🔍➕</span>
          Zoom In
        </button>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "12px",
          borderRadius: "6px",
          fontSize: "11px",
          marginBottom: "16px"
        }}>
        <strong>Keyboard Shortcuts:</strong>
        <div style={{ marginTop: "4px" }}>
          <div>Ctrl + Plus: Zoom In</div>
          <div>Ctrl + Minus: Zoom Out</div>
          <div>Ctrl + 0: Reset Zoom</div>
        </div>
      </div>

      <div style={{ fontSize: "12px", color: "#6c757d" }}>
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul style={{ paddingLeft: "16px", margin: "8px 0" }}>
          <li>Use quick buttons for common zoom levels</li>
          <li>Drag slider for custom zoom (25% - 400%)</li>
          <li>Use +/- buttons for fine adjustments</li>
          <li>Click "Reset" to return to 100%</li>
          <li>Keyboard shortcuts work on the active page</li>
        </ul>
        <p style={{ marginTop: "8px", fontStyle: "italic" }}>
          Note: Zoom affects the entire page content.
        </p>
      </div>
    </div>
  )
}
