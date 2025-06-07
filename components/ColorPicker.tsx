import { useState } from "react"

import type { ColorInfo, ExtensionMessage } from "~types"
import { copyToClipboard } from "~utils/colorUtils"

export default function ColorPicker() {
  const [isActive, setIsActive] = useState(false)
  const [currentColor, setCurrentColor] = useState<ColorInfo | null>(null)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [colorHistory, setColorHistory] = useState<ColorInfo[]>([])

  const toggleColorPicker = async () => {
    try {
      setError("")

      const newActiveState = !isActive

      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!tab || !tab.id) {
        throw new Error("No active tab found")
      }

      // Send message to content script via background
      const response = await chrome.runtime.sendMessage({
        type: "TOGGLE_COLOR_PICKER",
        payload: newActiveState
      })

      if (response.success) {
        setIsActive(newActiveState)
        if (newActiveState) {
          setStatus(
            "Color picker activated! Move mouse over page elements and click to copy colors."
          )

          // Listen for color updates from content script
          const messageListener = (message: any) => {
            if (message.type === "COLOR_PICKED") {
              setCurrentColor(message.color)
              addToHistory(message.color)
            }
          }

          chrome.runtime.onMessage.addListener(messageListener)

          // Store listener reference for cleanup
          if (newActiveState) {
            ;(window as any).colorPickerListener = messageListener
          }
        } else {
          setStatus("Color picker deactivated")
          setTimeout(() => setStatus(""), 2000)

          // Remove listener
          if ((window as any).colorPickerListener) {
            chrome.runtime.onMessage.removeListener(
              (window as any).colorPickerListener
            )
            delete (window as any).colorPickerListener
          }
        }
      } else {
        throw new Error(response.error || "Failed to toggle color picker")
      }
    } catch (error) {
      console.error("Color picker toggle error:", error)
      setError(error.message || "Failed to toggle color picker")
    }
  }

  const copyColorValue = async (value: string, label: string) => {
    try {
      await copyToClipboard(value)
      setStatus(`${label} copied to clipboard!`)
      setTimeout(() => setStatus(""), 2000)
    } catch (error) {
      setError("Failed to copy to clipboard")
    }
  }

  const addToHistory = (color: ColorInfo) => {
    setColorHistory((prev) => {
      const newHistory = [color, ...prev.filter((c) => c.hex !== color.hex)]
      return newHistory.slice(0, 8) // Keep only last 8 colors
    })
  }

  // Demo color for preview (in real implementation, this would come from content script)
  const demoColor: ColorInfo = {
    rgb: { r: 102, g: 126, b: 234 },
    hex: "#667eea",
    hsl: { h: 225, s: 73, l: 66 }
  }

  return (
    <div className="tool-section">
      <h3>🎨 Color Inspector</h3>

      {error && <div className="status-message status-error">{error}</div>}

      {status && <div className="status-message status-info">{status}</div>}

      {/* Toggle Button */}
      <button
        className={`btn ${isActive ? "btn-danger" : "btn-primary"}`}
        onClick={toggleColorPicker}>
        <span>{isActive ? "⏹️" : "🎯"}</span>
        {isActive ? "Stop Color Picker" : "Start Color Picker"}
      </button>

      {/* Current Color Preview */}
      <div
        className="color-preview"
        style={{
          backgroundColor: currentColor?.hex || demoColor.hex,
          color: currentColor
            ? currentColor.hsl.l > 50
              ? "#000"
              : "#fff"
            : demoColor.hsl.l > 50
              ? "#000"
              : "#fff"
        }}>
        {currentColor?.hex || demoColor.hex || "No color selected"}
      </div>

      {/* Color Information */}
      {(currentColor || demoColor) && (
        <div className="color-info">
          <div
            style={{ cursor: "pointer" }}
            onClick={() =>
              copyColorValue((currentColor || demoColor).hex, "HEX")
            }
            title="Click to copy">
            <strong>HEX:</strong> {(currentColor || demoColor).hex}
          </div>
          <div
            style={{ cursor: "pointer" }}
            onClick={() => {
              const rgb = (currentColor || demoColor).rgb
              copyColorValue(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, "RGB")
            }}
            title="Click to copy">
            <strong>RGB:</strong> {(currentColor || demoColor).rgb.r},{" "}
            {(currentColor || demoColor).rgb.g},{" "}
            {(currentColor || demoColor).rgb.b}
          </div>
          <div
            style={{ cursor: "pointer" }}
            onClick={() => {
              const hsl = (currentColor || demoColor).hsl
              copyColorValue(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, "HSL")
            }}
            title="Click to copy">
            <strong>HSL:</strong> {(currentColor || demoColor).hsl.h}°,{" "}
            {(currentColor || demoColor).hsl.s}%,{" "}
            {(currentColor || demoColor).hsl.l}%
          </div>
        </div>
      )}

      {/* Color History */}
      {colorHistory.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>
            Recent Colors:
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "4px"
            }}>
            {colorHistory.map((color, index) => (
              <div
                key={index}
                style={{
                  width: "100%",
                  height: "32px",
                  backgroundColor: color.hex,
                  border: "1px solid #e9ecef",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  color: color.hsl.l > 50 ? "#000" : "#fff"
                }}
                onClick={() => copyColorValue(color.hex, "Color")}
                title={`${color.hex} - Click to copy`}>
                {color.hex}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "16px" }}>
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul style={{ paddingLeft: "16px", margin: "8px 0" }}>
          <li>Click "Start Color Picker" to activate</li>
          <li>Move mouse over any element on the page</li>
          <li>Click on an element to copy its color</li>
          <li>Press ESC key to exit color picker mode</li>
          <li>Click on color values above to copy them</li>
        </ul>
        <p style={{ marginTop: "8px", fontStyle: "italic" }}>
          Note: You may need to refresh the page after first activation.
        </p>
      </div>
    </div>
  )
}
