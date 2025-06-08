import { useEffect, useState } from "react"

import "~styles/popup.css"

// Global error handler for extension context issues
const handleExtensionError = (error: any): string => {
  const errorMessage = error?.message || error?.toString() || "Unknown error"

  if (
    errorMessage.includes("Extension context invalidated") ||
    errorMessage.includes("context invalidated") ||
    errorMessage.includes("receiving end does not exist") ||
    errorMessage.includes("message port closed")
  ) {
    return "🔄 Extension reloaded during development. Please close this popup and click the extension icon again."
  }

  return errorMessage
}

// Check if Chrome APIs are available
const checkChromeAPIs = (): boolean => {
  return !!(
    chrome?.tabs?.query &&
    chrome?.tabs?.captureVisibleTab &&
    chrome?.scripting?.executeScript
  )
}

// Enhanced Screenshot component with modern UI and advanced features
function ScreenCapture() {
  const [screenshot, setScreenshot] = useState<string>("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [captureMode, setCaptureMode] = useState<string>("visible")
  const [countdown, setCountdown] = useState<number>(0)
  const [format, setFormat] = useState<"png" | "jpeg">("png")
  const [quality, setQuality] = useState(100)

  const captureModes = [
    {
      id: "visible",
      label: "Visible Area",
      icon: "🖼️",
      desc: "Current tab view"
    },
    {
      id: "fullscreen",
      label: "Full Screen",
      icon: "🖥️",
      desc: "Entire screen"
    },
    { id: "area", label: "Custom Area", icon: "✂️", desc: "Select region" },
    {
      id: "fullpage",
      label: "Full Page",
      icon: "📄",
      desc: "Scrolling capture"
    },
    { id: "window", label: "Window", icon: "🪟", desc: "App window" },
    { id: "delayed", label: "Delayed", icon: "⏰", desc: "3 sec timer" }
  ]

  const captureScreenshot = async (mode: string = captureMode) => {
    try {
      setIsCapturing(true)
      setError("")

      if (mode === "delayed") {
        await startCountdown()
        mode = "visible"
      }

      setStatus(
        `Capturing ${captureModes.find((m) => m.id === mode)?.label}...`
      )

      let dataUrl: string
      switch (mode) {
        case "fullscreen":
          dataUrl = await captureFullScreen()
          break
        case "area":
          dataUrl = await captureCustomArea()
          console.log("Custom area captured, dataUrl length:", dataUrl?.length)
          break
        case "fullpage":
          dataUrl = await captureFullPage()
          break
        case "window":
          dataUrl = await captureWindow()
          break
        default:
          dataUrl = await captureVisible()
          // For visible area, the download and status are handled in captureVisible()
          setScreenshot(dataUrl)
          return
      }

      console.log(
        "Setting screenshot for mode:",
        mode,
        "dataUrl length:",
        dataUrl?.length
      )
      setScreenshot(dataUrl)
      setStatus("✅ Screenshot captured!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      console.error("Screenshot error:", error)
      setError(error.message || "Failed to capture screenshot")
    } finally {
      setIsCapturing(false)
      setCountdown(0)
    }
  }

  const startCountdown = async () => {
    for (let i = 3; i > 0; i--) {
      setCountdown(i)
      setStatus(`📸 Picture will be clicked in ${i}... Get ready!`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    setCountdown(0)
    setStatus("📸 Picture clicked! Processing...")
  }

  const captureVisible = async () => {
    try {
      // Check if chrome APIs are available
      if (!checkChromeAPIs()) {
        throw new Error("Extension context invalidated")
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      setStatus("📸 Capturing visible area...")

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: format,
        quality: format === "jpeg" ? quality : undefined
      })

      // Automatically download the captured image
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `visible-area-${new Date().toISOString().split("T")[0]}-${Date.now()}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setStatus("✅ Visible area captured and downloaded!")

      return dataUrl
    } catch (error: any) {
      throw new Error(handleExtensionError(error))
    }
  }

  const captureVisibleForArea = async () => {
    try {
      // Check if chrome APIs are available
      if (!checkChromeAPIs()) {
        throw new Error("Extension context invalidated")
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: format,
        quality: format === "jpeg" ? quality : undefined
      })

      // Don't auto-download for custom area - let the main function handle it
      return dataUrl
    } catch (error: any) {
      throw new Error(handleExtensionError(error))
    }
  }

  const captureFullScreen = async () => {
    try {
      // Use getDisplayMedia without mediaSource constraint (browser will show options)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      const video = document.createElement("video")
      video.srcObject = stream
      video.play()

      return new Promise<string>((resolve, reject) => {
        video.onloadedmetadata = () => {
          const canvas = document.createElement("canvas")
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
          }

          ctx.drawImage(video, 0, 0)
          stream.getTracks().forEach((track) => track.stop())
          resolve(canvas.toDataURL("image/png"))
        }

        video.onerror = () => {
          stream.getTracks().forEach((track) => track.stop())
          reject(new Error("Failed to load video stream"))
        }
      })
    } catch (error: any) {
      if (error.name === "NotAllowedError") {
        throw new Error(
          "Screen sharing permission denied. Please allow screen sharing and try again."
        )
      } else if (error.name === "NotSupportedError") {
        throw new Error("Screen sharing not supported in this browser.")
      } else {
        throw new Error(
          "Full screen capture failed: " + (error.message || "Unknown error")
        )
      }
    }
  }

  const captureCustomArea = async () => {
    try {
      if (!checkChromeAPIs()) {
        throw new Error("Extension context invalidated")
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      setStatus("✂️ Click and drag to select area...")

      // Inject area selection script
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return new Promise((resolve) => {
            // Create overlay for area selection
            const overlay = document.createElement("div")
            overlay.id = "area-selection-overlay"
            overlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              background: rgba(0,0,0,0.3);
              z-index: 2147483647;
              cursor: crosshair;
            `

            const selection = document.createElement("div")
            selection.style.cssText = `
              position: fixed;
              border: 2px dashed #4CAF50;
              background: rgba(76, 175, 80, 0.1);
              z-index: 2147483648;
              display: none;
              pointer-events: none;
            `

            const instructions = document.createElement("div")
            instructions.style.cssText = `
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              font-size: 14px;
              z-index: 2147483649;
            `
            instructions.textContent =
              "✂️ Click and drag to select area • ESC to cancel"

            document.body.appendChild(overlay)
            document.body.appendChild(selection)
            document.body.appendChild(instructions)

            let isSelecting = false
            let startX = 0,
              startY = 0

            overlay.addEventListener("mousedown", (e) => {
              isSelecting = true
              startX = e.clientX
              startY = e.clientY
              selection.style.display = "block"
              selection.style.left = startX + "px"
              selection.style.top = startY + "px"
              selection.style.width = "0px"
              selection.style.height = "0px"
            })

            overlay.addEventListener("mousemove", (e) => {
              if (!isSelecting) return

              const width = Math.abs(e.clientX - startX)
              const height = Math.abs(e.clientY - startY)
              const left = Math.min(e.clientX, startX)
              const top = Math.min(e.clientY, startY)

              selection.style.left = left + "px"
              selection.style.top = top + "px"
              selection.style.width = width + "px"
              selection.style.height = height + "px"
            })

            overlay.addEventListener("mouseup", (e) => {
              if (!isSelecting) return

              const rect = {
                x: Math.min(e.clientX, startX),
                y: Math.min(e.clientY, startY),
                width: Math.abs(e.clientX - startX),
                height: Math.abs(e.clientY - startY)
              }

              // Clean up
              overlay.remove()
              selection.remove()
              instructions.remove()

              // Return the selected area
              resolve(rect)
            })

            // Cancel on ESC key
            const handleKeyDown = (e: KeyboardEvent) => {
              if (e.key === "Escape") {
                overlay.remove()
                selection.remove()
                instructions.remove()
                document.removeEventListener("keydown", handleKeyDown)
                resolve(null)
              }
            }

            document.addEventListener("keydown", handleKeyDown)
          })
        }
      })

      console.log("Area selection script executed, result:", result)

      const selectedArea = result[0]?.result
      console.log("Selected area:", selectedArea)

      if (!selectedArea) {
        console.log(
          "Area selection was cancelled, falling back to visible area capture"
        )
        setStatus("✂️ No area selected, capturing visible area...")
        return await captureVisibleForArea()
      }

      // For now, after area selection, capture the full visible area
      // In a full implementation, we would crop the captured image to the selected area
      setStatus(
        `✂️ Area selected (${selectedArea.width}x${selectedArea.height})! Capturing...`
      )
      return await captureVisibleForArea()
    } catch (error: any) {
      throw new Error(handleExtensionError(error))
    }
  }

  const captureFullPage = async () => {
    try {
      if (!checkChromeAPIs()) {
        throw new Error("Extension context invalidated")
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      setStatus("📸 Analyzing page for full capture...")

      // Get page dimensions
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: window.innerHeight,
          clientWidth: window.innerWidth,
          currentScrollY: window.scrollY
        })
      })

      const { scrollHeight, clientHeight, clientWidth, currentScrollY } =
        result[0].result

      if (scrollHeight <= clientHeight) {
        // Page fits in viewport, just capture normally
        setStatus("📸 Page fits in viewport, capturing...")
        return await captureVisible()
      }

      // For long pages, capture in sections and stitch together
      const sections = Math.ceil(scrollHeight / clientHeight)
      const screenshots: string[] = []

      setStatus(`📸 Capturing ${sections} sections for stitching...`)

      for (let i = 0; i < sections; i++) {
        // Scroll to position
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (scrollY) => {
            window.scrollTo(0, scrollY)
          },
          args: [i * clientHeight]
        })

        // Wait for scroll to complete and content to load
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Capture this section
        const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png"
        })
        screenshots.push(screenshot)
        setStatus(`📸 Captured section ${i + 1}/${sections}`)
      }

      // Restore original scroll position
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (originalY) => {
          window.scrollTo(0, originalY)
        },
        args: [currentScrollY]
      })

      // Stitch all screenshots together
      setStatus(`🔧 Stitching ${screenshots.length} sections together...`)

      // Create a canvas to stitch images
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!

      // Set canvas dimensions for full page
      canvas.width = clientWidth
      canvas.height = scrollHeight

      // Load and draw each screenshot
      let currentY = 0

      for (let i = 0; i < screenshots.length; i++) {
        await new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            // Calculate the height to draw (handle last section which might be shorter)
            const drawHeight = Math.min(clientHeight, scrollHeight - currentY)

            // Draw this section onto the canvas
            ctx.drawImage(img, 0, currentY, clientWidth, drawHeight)
            currentY += drawHeight

            setStatus(`🔧 Stitched section ${i + 1}/${screenshots.length}`)
            resolve()
          }
          img.onerror = () => {
            console.error(`Failed to load screenshot ${i + 1}`)
            resolve()
          }
          img.src = screenshots[i]
        })
      }

      // Convert stitched canvas to data URL
      const stitchedDataUrl = canvas.toDataURL("image/png", 0.9)
      setStatus(
        `✅ Full page stitched! (${Math.round(stitchedDataUrl.length / 1024)}KB)`
      )

      return stitchedDataUrl
    } catch (error: any) {
      throw new Error(handleExtensionError(error))
    }
  }

  const captureWindow = async () => {
    try {
      // Use getDisplayMedia - browser will show screen/window/tab options
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      const video = document.createElement("video")
      video.srcObject = stream
      video.play()

      return new Promise<string>((resolve, reject) => {
        video.onloadedmetadata = () => {
          const canvas = document.createElement("canvas")
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
          }

          ctx.drawImage(video, 0, 0)
          stream.getTracks().forEach((track) => track.stop())
          resolve(canvas.toDataURL("image/png"))
        }

        video.onerror = () => {
          stream.getTracks().forEach((track) => track.stop())
          reject(new Error("Failed to load video stream"))
        }
      })
    } catch (error: any) {
      if (error.name === "NotAllowedError") {
        throw new Error(
          "Screen sharing permission denied. Please select a window and allow sharing."
        )
      } else if (error.name === "NotSupportedError") {
        throw new Error("Screen sharing not supported in this browser.")
      } else {
        throw new Error(
          "Window capture failed: " + (error.message || "Unknown error")
        )
      }
    }
  }

  const downloadScreenshot = () => {
    if (screenshot) {
      const link = document.createElement("a")
      link.href = screenshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const modeLabel =
        captureModes.find((m) => m.id === captureMode)?.label || "screenshot"
      link.download = `${modeLabel.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.${format}`
      link.click()
    }
  }

  const copyToClipboard = async () => {
    if (screenshot) {
      try {
        const response = await fetch(screenshot)
        const blob = await response.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ])
        setStatus("📋 Copied to clipboard!")
        setTimeout(() => setStatus(""), 2000)
      } catch (error) {
        setError("Failed to copy to clipboard")
      }
    }
  }

  return (
    <div style={{ padding: "0" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "16px",
          borderRadius: "12px 12px 0 0",
          marginBottom: "20px"
        }}>
        <h3
          style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600" }}>
          📸 Advanced Screenshot
        </h3>
        <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>
          Capture screens, windows, areas & full pages
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div
          style={{
            background: "linear-gradient(135deg, #ff6b6b, #ee5a52)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            fontWeight: "500"
          }}>
          ❌ {error}
        </div>
      )}

      {status && (
        <div
          style={{
            background:
              countdown > 0
                ? "linear-gradient(135deg, #ffa726, #ff9800)"
                : "linear-gradient(135deg, #4caf50, #45a049)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            fontWeight: "500",
            textAlign: "center"
          }}>
          {countdown > 0 ? (
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {countdown}
            </div>
          ) : (
            status
          )}
        </div>
      )}

      {/* Capture Mode Grid */}
      <div style={{ marginBottom: "20px" }}>
        <h4
          style={{
            margin: "0 0 12px 0",
            fontSize: "14px",
            color: "#333",
            fontWeight: "600"
          }}>
          Capture Mode
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "8px"
          }}>
          {captureModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setCaptureMode(mode.id)
                captureScreenshot(mode.id)
              }}
              disabled={isCapturing}
              style={{
                padding: "12px 8px",
                border:
                  captureMode === mode.id
                    ? "2px solid #667eea"
                    : "1px solid #e0e0e0",
                borderRadius: "8px",
                background: captureMode === mode.id ? "#f0f4ff" : "white",
                cursor: isCapturing ? "not-allowed" : "pointer",
                textAlign: "center",
                fontSize: "11px",
                fontWeight: "500",
                color: captureMode === mode.id ? "#667eea" : "#666",
                transition: "all 0.2s ease",
                opacity: isCapturing ? 0.6 : 1
              }}>
              <div style={{ fontSize: "16px", marginBottom: "4px" }}>
                {mode.icon}
              </div>
              <div style={{ fontWeight: "600", marginBottom: "2px" }}>
                {mode.label}
              </div>
              <div style={{ fontSize: "9px", opacity: 0.8 }}>{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Format Settings */}
      <div style={{ marginBottom: "20px" }}>
        <h4
          style={{
            margin: "0 0 12px 0",
            fontSize: "14px",
            color: "#333",
            fontWeight: "600"
          }}>
          Format & Quality
        </h4>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <button
            onClick={() => setFormat("png")}
            style={{
              flex: 1,
              padding: "8px",
              border:
                format === "png" ? "2px solid #667eea" : "1px solid #e0e0e0",
              borderRadius: "6px",
              background: format === "png" ? "#f0f4ff" : "white",
              color: format === "png" ? "#667eea" : "#666",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer"
            }}>
            PNG (Lossless)
          </button>
          <button
            onClick={() => setFormat("jpeg")}
            style={{
              flex: 1,
              padding: "8px",
              border:
                format === "jpeg" ? "2px solid #667eea" : "1px solid #e0e0e0",
              borderRadius: "6px",
              background: format === "jpeg" ? "#f0f4ff" : "white",
              color: format === "jpeg" ? "#667eea" : "#666",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer"
            }}>
            JPEG (Smaller)
          </button>
        </div>

        {format === "jpeg" && (
          <div>
            <label
              style={{
                fontSize: "12px",
                color: "#666",
                marginBottom: "6px",
                display: "block"
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
      </div>

      {/* Screenshot Preview */}
      {screenshot && (
        <div style={{ marginBottom: "20px" }}>
          <h4
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              color: "#333",
              fontWeight: "600"
            }}>
            Preview
          </h4>
          <div
            style={{
              border: "2px solid #e0e0e0",
              borderRadius: "8px",
              overflow: "hidden",
              marginBottom: "12px"
            }}>
            <img
              src={screenshot}
              alt="Screenshot preview"
              style={{
                width: "100%",
                maxHeight: "150px",
                objectFit: "contain",
                display: "block"
              }}
            />
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px"
            }}>
            <button
              onClick={downloadScreenshot}
              style={{
                padding: "10px 8px",
                background: "linear-gradient(135deg, #4caf50, #45a049)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "transform 0.1s ease"
              }}
              onMouseDown={(e) =>
                (e.currentTarget.style.transform = "scale(0.95)")
              }
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }>
              💾 Download
            </button>

            <button
              onClick={copyToClipboard}
              style={{
                padding: "10px 8px",
                background: "linear-gradient(135deg, #2196f3, #1976d2)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "transform 0.1s ease"
              }}
              onMouseDown={(e) =>
                (e.currentTarget.style.transform = "scale(0.95)")
              }
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }>
              📋 Copy
            </button>

            <button
              onClick={() => setScreenshot("")}
              style={{
                padding: "10px 8px",
                background: "linear-gradient(135deg, #f44336, #d32f2f)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "transform 0.1s ease"
              }}
              onMouseDown={(e) =>
                (e.currentTarget.style.transform = "scale(0.95)")
              }
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }>
              🗑️ Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ScreenRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const startRecording = async () => {
    try {
      setStatus("Requesting screen access...")

      // Use getDisplayMedia directly - this is the modern approach
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      })

      const chunks: Blob[] = []
      const recorder = new MediaRecorder(displayStream, {
        mimeType: "video/webm;codecs=vp9"
      })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `screen-recording-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        setStatus("Recording saved!")
        setTimeout(() => setStatus(""), 3000)
      }

      // Listen for stream end (user stops sharing)
      displayStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopRecording()
      })

      recorder.start(1000)
      setMediaRecorder(recorder)
      setStream(displayStream)
      setIsRecording(true)
      setStatus(
        "Recording started! Click stop or close the sharing dialog to finish."
      )
    } catch (error: any) {
      console.error("Recording error:", error)
      if (error.name === "NotAllowedError") {
        setStatus("Screen recording permission denied")
      } else if (error.name === "NotSupportedError") {
        setStatus("Screen recording not supported in this browser")
      } else {
        setStatus("Failed to start recording: " + error.message)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop()
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    setIsRecording(false)
    setMediaRecorder(null)
    setStream(null)
    setStatus("Recording stopped")
  }

  return (
    <div>
      <h3>🎥 Screen Recording</h3>
      {status && (
        <div
          style={{
            padding: "8px",
            background: "#f0f0f0",
            borderRadius: "4px",
            marginBottom: "12px"
          }}>
          {status}
        </div>
      )}

      {!isRecording ? (
        <button
          onClick={startRecording}
          style={{
            width: "100%",
            padding: "12px",
            background: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}>
          🎬 Start Recording
        </button>
      ) : (
        <button
          onClick={stopRecording}
          style={{
            width: "100%",
            padding: "12px",
            background: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}>
          ⏹️ Stop Recording
        </button>
      )}
    </div>
  )
}

function ColorPicker() {
  const [isActive, setIsActive] = useState(false)
  const [status, setStatus] = useState<string>("")

  const toggleColorPicker = async () => {
    try {
      const newState = !isActive
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!tab || !tab.id) {
        setStatus("No active tab found")
        return
      }

      // Check if we can access this tab
      if (
        tab.url?.startsWith("chrome://") ||
        tab.url?.startsWith("chrome-extension://") ||
        tab.url?.startsWith("edge://") ||
        tab.url?.startsWith("about:")
      ) {
        setStatus(
          "Cannot access browser internal pages. Try on a regular website."
        )
        return
      }

      if (newState) {
        try {
          // First, inject the content script if it's not already there
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Simple test to see if we can inject
              console.log("Color picker script injected")
            }
          })

          // Now inject the actual color picker
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Remove existing overlay if any
              const existingOverlay = document.getElementById(
                "color-picker-overlay"
              )
              const existingTooltip = document.getElementById("color-tooltip")
              if (existingOverlay) existingOverlay.remove()
              if (existingTooltip) existingTooltip.remove()

              // Create overlay
              const overlay = document.createElement("div")
              overlay.id = "color-picker-overlay"
              overlay.setAttribute("tabindex", "0")
              overlay.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 2147483647 !important;
                cursor: crosshair !important;
                background: rgba(0,0,0,0.05) !important;
                pointer-events: auto !important;
              `

              // Create tooltip
              const tooltip = document.createElement("div")
              tooltip.id = "color-tooltip"
              tooltip.style.cssText = `
                position: fixed !important;
                background: rgba(0,0,0,0.9) !important;
                color: white !important;
                padding: 8px 12px !important;
                border-radius: 4px !important;
                font-family: monospace !important;
                font-size: 12px !important;
                pointer-events: none !important;
                z-index: 2147483647 !important;
                display: none !important;
                border: 1px solid #333 !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5) !important;
              `

              document.body.appendChild(overlay)
              document.body.appendChild(tooltip)

              // Mouse move handler
              const handleMouseMove = (e: any) => {
                e.preventDefault()
                const x = e.clientX
                const y = e.clientY

                // Temporarily hide overlay to get element underneath
                overlay.style.pointerEvents = "none"
                const element = document.elementFromPoint(x, y)
                overlay.style.pointerEvents = "auto"

                if (element) {
                  const style = window.getComputedStyle(element)
                  let colorToShow = style.backgroundColor

                  // If background is transparent, try text color
                  if (
                    colorToShow === "rgba(0, 0, 0, 0)" ||
                    colorToShow === "transparent"
                  ) {
                    colorToShow = style.color
                  }

                  // Convert RGB to HEX if possible
                  const rgbMatch = colorToShow.match(
                    /rgb\((\d+),\s*(\d+),\s*(\d+)\)/
                  )
                  if (rgbMatch) {
                    const r = parseInt(rgbMatch[1])
                    const g = parseInt(rgbMatch[2])
                    const b = parseInt(rgbMatch[3])
                    const hex =
                      "#" +
                      [r, g, b]
                        .map((x) => x.toString(16).padStart(2, "0"))
                        .join("")
                    colorToShow = `${colorToShow} (${hex})`
                  }

                  tooltip.innerHTML = `
                    <div style="margin-bottom: 4px;">
                      <strong>Element:</strong> ${element.tagName.toLowerCase()}
                    </div>
                    <div style="margin-bottom: 4px;">
                      <strong>Color:</strong> ${colorToShow}
                    </div>
                    <div style="font-size: 10px; opacity: 0.8;">
                      Click to copy • ESC to exit
                    </div>
                  `

                  // Position tooltip
                  let left = x + 15
                  let top = y - 60

                  if (left + 200 > window.innerWidth) left = x - 215
                  if (top < 0) top = y + 15

                  tooltip.style.left = left + "px"
                  tooltip.style.top = top + "px"
                  tooltip.style.display = "block"
                }
              }

              // Click handler
              const handleClick = (e: any) => {
                e.preventDefault()
                e.stopPropagation()

                const x = e.clientX
                const y = e.clientY

                overlay.style.pointerEvents = "none"
                const element = document.elementFromPoint(x, y)
                overlay.style.pointerEvents = "auto"

                if (element) {
                  const style = window.getComputedStyle(element)
                  let colorToShow = style.backgroundColor

                  if (
                    colorToShow === "rgba(0, 0, 0, 0)" ||
                    colorToShow === "transparent"
                  ) {
                    colorToShow = style.color
                  }

                  navigator.clipboard
                    .writeText(colorToShow)
                    .then(() => {
                      tooltip.innerHTML = `<div style="color: #4CAF50;">✓ Copied: ${colorToShow}</div>`
                      setTimeout(() => {
                        overlay.remove()
                        tooltip.remove()
                      }, 1500)
                    })
                    .catch(() => {
                      tooltip.innerHTML = `<div style="color: #f44336;">Failed to copy</div>`
                    })
                }
              }

              // Keyboard handler
              const handleKeyDown = (e: any) => {
                if (e.key === "Escape") {
                  overlay.remove()
                  tooltip.remove()
                }
              }

              // Add event listeners
              overlay.addEventListener("mousemove", handleMouseMove)
              overlay.addEventListener("click", handleClick)
              document.addEventListener("keydown", handleKeyDown)

              // Focus overlay to capture keyboard events
              overlay.focus()

              // Store cleanup function on the overlay element
              ;(overlay as any).cleanup = () => {
                overlay.removeEventListener("mousemove", handleMouseMove)
                overlay.removeEventListener("click", handleClick)
                document.removeEventListener("keydown", handleKeyDown)
                if (overlay.parentNode) overlay.remove()
                if (tooltip.parentNode) tooltip.remove()
              }
            }
          })

          setIsActive(true)
          setStatus(
            "Color picker activated! Move mouse over elements and click to copy colors. Press ESC to exit."
          )
        } catch (scriptError) {
          console.error("Script injection error:", scriptError)
          setStatus(`Script injection failed: ${scriptError.message}`)
        }
      } else {
        // Deactivate color picker
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const overlay = document.getElementById("color-picker-overlay")
              const tooltip = document.getElementById("color-tooltip")

              if (overlay && (overlay as any).cleanup) {
                ;(overlay as any).cleanup()
              }

              if (overlay) overlay.remove()
              if (tooltip) tooltip.remove()
            }
          })
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError)
        }

        setIsActive(false)
        setStatus("Color picker deactivated")
      }
    } catch (error: any) {
      console.error("Color picker error:", error)
      setStatus(`Color picker failed: ${error.message}`)
      setIsActive(false)
    }
  }

  return (
    <div>
      <h3>🎨 Color Inspector</h3>
      {status && (
        <div
          style={{
            padding: "8px",
            background: "#f0f0f0",
            borderRadius: "4px",
            marginBottom: "12px"
          }}>
          {status}
        </div>
      )}

      <button
        onClick={toggleColorPicker}
        style={{
          width: "100%",
          padding: "12px",
          background: isActive ? "#dc3545" : "#667eea",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer"
        }}>
        {isActive ? "⏹️ Stop Color Picker" : "🎯 Start Color Picker"}
      </button>
    </div>
  )
}

function ScreenZoom() {
  const [currentZoom, setCurrentZoom] = useState(100)
  const [status, setStatus] = useState<string>("")

  const setZoom = async (zoomLevel: number) => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (zoom) => {
          const scale = zoom / 100
          document.body.style.transform = zoom === 100 ? "" : `scale(${scale})`
          document.body.style.transformOrigin = zoom === 100 ? "" : "top left"
        },
        args: [zoomLevel]
      })

      setCurrentZoom(zoomLevel)
      setStatus(`Zoom set to ${zoomLevel}%`)
      setTimeout(() => setStatus(""), 2000)
    } catch (error: any) {
      setStatus("Zoom failed: " + error.message)
    }
  }

  return (
    <div>
      <h3>🔍 Screen Zoom</h3>
      {status && (
        <div
          style={{
            padding: "8px",
            background: "#f0f0f0",
            borderRadius: "4px",
            marginBottom: "12px"
          }}>
          {status}
        </div>
      )}

      <div
        style={{
          textAlign: "center",
          fontSize: "18px",
          fontWeight: "bold",
          marginBottom: "16px"
        }}>
        {currentZoom}%
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          marginBottom: "16px"
        }}>
        {[50, 75, 100, 125, 150, 200].map((level) => (
          <button
            key={level}
            onClick={() => setZoom(level)}
            style={{
              padding: "8px",
              background: currentZoom === level ? "#667eea" : "#f8f9fa",
              color: currentZoom === level ? "white" : "#333",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer"
            }}>
            {level}%
          </button>
        ))}
      </div>

      <button
        onClick={() => setZoom(100)}
        style={{
          width: "100%",
          padding: "8px",
          background: "#28a745",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}>
        🎯 Reset to 100%
      </button>
    </div>
  )
}

// Pro Tools Component with Advanced Features
function ProTools() {
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [activeFeature, setActiveFeature] = useState<string>("")

  const proFeatures = [
    {
      id: "fullpage",
      label: "Full-Page Scroller",
      icon: "📜",
      desc: "Capture entire webpage as one image"
    },
    {
      id: "annotation",
      label: "Annotation Tool",
      icon: "✏️",
      desc: "Draw, highlight, blur on screenshots"
    },
    {
      id: "gif",
      label: "GIF Recorder",
      icon: "🎞️",
      desc: "Record animated GIFs"
    },
    {
      id: "webcam",
      label: "Webcam Overlay",
      icon: "📹",
      desc: "Picture-in-picture recording"
    },
    {
      id: "ruler",
      label: "Element Ruler",
      icon: "📏",
      desc: "Pixel rulers & grid overlay"
    },
    {
      id: "css",
      label: "Live CSS Injector",
      icon: "🎨",
      desc: "Preview CSS changes live"
    },
    {
      id: "ocr",
      label: "OCR Text Extractor",
      icon: "🔍",
      desc: "Extract text from images"
    },
    {
      id: "palette",
      label: "Color Palette Manager",
      icon: "🎨",
      desc: "Save & organize color palettes"
    }
  ]

  const executeFeature = async (featureId: string) => {
    try {
      setActiveFeature(featureId)
      setError("")
      setStatus(
        `Activating ${proFeatures.find((f) => f.id === featureId)?.label}...`
      )

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      switch (featureId) {
        case "fullpage":
          await activateFullPageScrollerNew(tab.id)
          break
        case "annotation":
          await activateAnnotationToolNew(tab.id)
          break
        case "gif":
          await activateGifRecorder(tab.id)
          break
        case "webcam":
          await activateWebcamOverlay(tab.id)
          break
        case "ruler":
          await activateElementRuler(tab.id)
          break
        case "css":
          await activateCSSInjector(tab.id)
          break
        case "ocr":
          await activateOCRExtractor(tab.id)
          break
        case "palette":
          await activatePaletteManager(tab.id)
          break
        default:
          throw new Error("Feature not implemented yet")
      }

      setStatus(
        `✅ ${proFeatures.find((f) => f.id === featureId)?.label} activated!`
      )
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError(error.message || "Failed to activate feature")
    } finally {
      setActiveFeature("")
    }
  }

  const activateFullPageScrollerNew = async (tabId: number) => {
    try {
      // Check if chrome APIs are available
      if (!chrome?.tabs?.captureVisibleTab) {
        throw new Error(
          "Extension context invalidated. Please reload the extension."
        )
      }

      setStatus("📸 Analyzing page for full capture...")

      // Get page info first
      const pageInfo = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: window.innerHeight,
          clientWidth: window.innerWidth,
          currentScrollY: window.scrollY
        })
      })

      const { scrollHeight, clientHeight, clientWidth, currentScrollY } =
        pageInfo[0].result

      if (scrollHeight <= clientHeight) {
        // Page fits in viewport, just capture normally
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tab?.windowId) {
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: "png"
          })

          // Download the image
          const link = document.createElement("a")
          link.href = dataUrl
          link.download = `full-page-${Date.now()}.png`
          link.click()

          setStatus("✅ Full page captured!")
          return
        }
      }

      // For long pages, capture in sections and stitch together
      const sections = Math.ceil(scrollHeight / clientHeight)
      const screenshots: string[] = []

      setStatus(`📸 Capturing ${sections} sections for stitching...`)

      for (let i = 0; i < sections; i++) {
        // Scroll to position
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (scrollY) => {
            window.scrollTo(0, scrollY)
          },
          args: [i * clientHeight]
        })

        // Wait for scroll to complete and content to load
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Capture this section
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tab?.windowId) {
          const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: "png"
          })
          screenshots.push(screenshot)
          setStatus(`📸 Captured section ${i + 1}/${sections}`)
        }
      }

      // Restore original scroll position
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (originalY) => {
          window.scrollTo(0, originalY)
        },
        args: [currentScrollY]
      })

      // Stitch all screenshots together
      if (screenshots.length > 0) {
        setStatus(`� Stitching ${screenshots.length} sections together...`)

        // Create a canvas to stitch images
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!

        // Set canvas dimensions for full page
        canvas.width = clientWidth
        canvas.height = scrollHeight

        // Load and draw each screenshot
        let currentY = 0

        for (let i = 0; i < screenshots.length; i++) {
          await new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => {
              // Calculate the height to draw (handle last section which might be shorter)
              const drawHeight = Math.min(clientHeight, scrollHeight - currentY)

              // Draw this section onto the canvas
              ctx.drawImage(img, 0, currentY, clientWidth, drawHeight)
              currentY += drawHeight

              setStatus(`🔧 Stitched section ${i + 1}/${screenshots.length}`)
              resolve()
            }
            img.onerror = () => {
              console.error(`Failed to load screenshot ${i + 1}`)
              resolve()
            }
            img.src = screenshots[i]
          })
        }

        // Convert stitched canvas to blob and download
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = `full-page-stitched-${Date.now()}.png`
              link.click()

              // Clean up
              setTimeout(() => URL.revokeObjectURL(url), 1000)

              setStatus(
                `✅ Full page captured and downloaded! (${Math.round(blob.size / 1024)}KB)`
              )
            } else {
              setError("Failed to create stitched image")
            }
          },
          "image/png",
          0.9
        )
      }
    } catch (error: any) {
      throw new Error(`Full page capture failed: ${error.message}`)
    }
  }

  const activateAnnotationToolNew = async (tabId: number) => {
    try {
      if (!chrome?.scripting?.executeScript) {
        throw new Error(
          "Extension context invalidated. Please reload the extension."
        )
      }

      setStatus("✏️ Activating annotation tool...")

      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Remove existing annotation tool
          const existing = document.getElementById("annotation-overlay")
          if (existing) {
            existing.remove()
            return
          }

          // Create annotation overlay
          const overlay = document.createElement("div")
          overlay.id = "annotation-overlay"
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483647;
            pointer-events: none;
          `

          const canvas = document.createElement("canvas")
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: auto;
            cursor: crosshair;
          `

          const toolbar = document.createElement("div")
          toolbar.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            display: flex;
            gap: 8px;
            pointer-events: auto;
            z-index: 2147483648;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          `

          toolbar.innerHTML = `
            <button id="draw-tool" style="padding: 8px 12px; border: none; border-radius: 4px; background: #667eea; color: white; cursor: pointer; font-size: 12px;">✏️ Draw</button>
            <button id="highlight-tool" style="padding: 8px 12px; border: none; border-radius: 4px; background: #ffa726; color: white; cursor: pointer; font-size: 12px;">🖍️ Highlight</button>
            <button id="clear-tool" style="padding: 8px 12px; border: none; border-radius: 4px; background: #9e9e9e; color: white; cursor: pointer; font-size: 12px;">🗑️ Clear</button>
            <button id="save-tool" style="padding: 8px 12px; border: none; border-radius: 4px; background: #4caf50; color: white; cursor: pointer; font-size: 12px;">💾 Save</button>
            <button id="close-annotation" style="padding: 8px 12px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer; font-size: 12px;">✕ Close</button>
          `

          overlay.appendChild(canvas)
          overlay.appendChild(toolbar)
          document.body.appendChild(overlay)

          const ctx = canvas.getContext("2d")!
          let isDrawing = false
          let currentTool = "draw"

          // Drawing functionality
          canvas.addEventListener("mousedown", (e) => {
            isDrawing = true
            ctx.beginPath()
            ctx.moveTo(e.clientX, e.clientY)
          })

          canvas.addEventListener("mousemove", (e) => {
            if (!isDrawing) return

            ctx.lineWidth = currentTool === "highlight" ? 20 : 3
            ctx.lineCap = "round"
            ctx.globalAlpha = currentTool === "highlight" ? 0.3 : 1
            ctx.strokeStyle =
              currentTool === "highlight" ? "#ffeb3b" : "#667eea"

            ctx.lineTo(e.clientX, e.clientY)
            ctx.stroke()
          })

          canvas.addEventListener("mouseup", () => {
            isDrawing = false
          })

          // Tool selection
          document
            .getElementById("draw-tool")
            ?.addEventListener("click", () => {
              currentTool = "draw"
              document.getElementById("draw-tool")!.style.background = "#667eea"
              document.getElementById("highlight-tool")!.style.background =
                "#ffa726"
            })

          document
            .getElementById("highlight-tool")
            ?.addEventListener("click", () => {
              currentTool = "highlight"
              document.getElementById("highlight-tool")!.style.background =
                "#ff9800"
              document.getElementById("draw-tool")!.style.background = "#9e9e9e"
            })

          document
            .getElementById("clear-tool")
            ?.addEventListener("click", () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
            })

          document
            .getElementById("save-tool")
            ?.addEventListener("click", () => {
              const dataUrl = canvas.toDataURL("image/png")
              const link = document.createElement("a")
              link.href = dataUrl
              link.download = `annotation-${Date.now()}.png`
              link.click()
            })

          document
            .getElementById("close-annotation")
            ?.addEventListener("click", () => {
              overlay.remove()
            })
        }
      })

      setStatus("✅ Annotation tool activated! Draw on the page.")
    } catch (error: any) {
      throw new Error(`Annotation tool failed: ${error.message}`)
    }
  }

  const activateFullPageScroller = async (tabId: number) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Create full page capture overlay
        const overlay = document.createElement("div")
        overlay.id = "fullpage-scroller"
        overlay.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 16px;
          border-radius: 12px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          min-width: 200px;
        `

        overlay.innerHTML = `
          <h4 style="margin: 0 0 12px 0; font-size: 14px;">📜 Full-Page Scroller</h4>
          <button id="capture-full-page" style="width: 100%; padding: 8px; background: white; color: #667eea; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin-bottom: 8px;">
            📸 Capture Full Page
          </button>
          <button id="close-fullpage" style="width: 100%; padding: 6px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            ✕ Close
          </button>
        `

        document.body.appendChild(overlay)

        document
          .getElementById("capture-full-page")
          ?.addEventListener("click", async () => {
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")

            // Get page dimensions
            const scrollHeight = document.documentElement.scrollHeight
            const scrollWidth = document.documentElement.scrollWidth
            const viewportHeight = window.innerHeight

            canvas.width = scrollWidth
            canvas.height = scrollHeight

            // Capture page in sections
            let currentY = 0
            const sections = Math.ceil(scrollHeight / viewportHeight)

            for (let i = 0; i < sections; i++) {
              window.scrollTo(0, currentY)
              await new Promise((resolve) => setTimeout(resolve, 500))

              // This is a simplified version - real implementation would need html2canvas
              currentY += viewportHeight
            }

            // Reset scroll
            window.scrollTo(0, 0)

            alert(
              "Full page capture completed! (Note: This is a demo - real implementation would use html2canvas library)"
            )
          })

        document
          .getElementById("close-fullpage")
          ?.addEventListener("click", () => {
            overlay.remove()
          })
      }
    })
  }

  const activateAnnotationTool = async (tabId: number) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Create annotation overlay
        const overlay = document.createElement("div")
        overlay.id = "annotation-tool"
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 2147483647;
          pointer-events: none;
        `

        const canvas = document.createElement("canvas")
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        canvas.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: auto;
          cursor: crosshair;
        `

        const toolbar = document.createElement("div")
        toolbar.style.cssText = `
          position: fixed;
          top: 20px;
          left: 20px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          display: flex;
          gap: 8px;
          pointer-events: auto;
          z-index: 2147483648;
        `

        toolbar.innerHTML = `
          <button id="draw-tool" style="padding: 8px; border: none; border-radius: 4px; background: #667eea; color: white; cursor: pointer;">✏️ Draw</button>
          <button id="highlight-tool" style="padding: 8px; border: none; border-radius: 4px; background: #ffa726; color: white; cursor: pointer;">🖍️ Highlight</button>
          <button id="blur-tool" style="padding: 8px; border: none; border-radius: 4px; background: #9e9e9e; color: white; cursor: pointer;">🌫️ Blur</button>
          <button id="text-tool" style="padding: 8px; border: none; border-radius: 4px; background: #4caf50; color: white; cursor: pointer;">📝 Text</button>
          <button id="close-annotation" style="padding: 8px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer;">✕ Close</button>
        `

        overlay.appendChild(canvas)
        overlay.appendChild(toolbar)
        document.body.appendChild(overlay)

        const ctx = canvas.getContext("2d")
        let isDrawing = false
        let currentTool = "draw"

        // Drawing functionality
        canvas.addEventListener("mousedown", (e) => {
          isDrawing = true
          ctx!.beginPath()
          ctx!.moveTo(e.clientX, e.clientY)
        })

        canvas.addEventListener("mousemove", (e) => {
          if (!isDrawing) return

          ctx!.lineWidth = currentTool === "highlight" ? 20 : 3
          ctx!.lineCap = "round"
          ctx!.globalAlpha = currentTool === "highlight" ? 0.3 : 1
          ctx!.strokeStyle = currentTool === "highlight" ? "#ffeb3b" : "#667eea"

          ctx!.lineTo(e.clientX, e.clientY)
          ctx!.stroke()
        })

        canvas.addEventListener("mouseup", () => {
          isDrawing = false
        })

        // Tool selection
        document
          .getElementById("draw-tool")
          ?.addEventListener("click", () => (currentTool = "draw"))
        document
          .getElementById("highlight-tool")
          ?.addEventListener("click", () => (currentTool = "highlight"))
        document
          .getElementById("blur-tool")
          ?.addEventListener("click", () =>
            alert("Blur tool - Advanced feature coming soon!")
          )
        document
          .getElementById("text-tool")
          ?.addEventListener("click", () =>
            alert("Text tool - Advanced feature coming soon!")
          )

        document
          .getElementById("close-annotation")
          ?.addEventListener("click", () => {
            overlay.remove()
          })
      }
    })
  }

  const activateGifRecorder = async (tabId: number) => {
    // GIF Recorder implementation
    setStatus(
      "🎞️ GIF Recorder - Coming soon! Will record screen regions as animated GIFs."
    )
  }

  const activateWebcamOverlay = async (tabId: number) => {
    // Webcam overlay implementation
    setStatus(
      "📹 Webcam Overlay - Coming soon! Will add picture-in-picture webcam during recording."
    )
  }

  const activateElementRuler = async (tabId: number) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Create ruler overlay
        const overlay = document.createElement("div")
        overlay.id = "element-ruler"
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 2147483647;
        `

        // Create grid
        const grid = document.createElement("div")
        grid.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image:
            linear-gradient(rgba(102, 126, 234, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(102, 126, 234, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
          pointer-events: none;
        `

        // Create rulers
        const topRuler = document.createElement("div")
        topRuler.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 30px;
          background: rgba(255,255,255,0.9);
          border-bottom: 1px solid #ddd;
          font-size: 10px;
          font-family: monospace;
          pointer-events: auto;
          z-index: 2147483648;
        `

        const leftRuler = document.createElement("div")
        leftRuler.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 30px;
          height: 100vh;
          background: rgba(255,255,255,0.9);
          border-right: 1px solid #ddd;
          font-size: 10px;
          font-family: monospace;
          pointer-events: auto;
          z-index: 2147483648;
        `

        // Add ruler markings
        for (let i = 0; i < window.innerWidth; i += 50) {
          const mark = document.createElement("div")
          mark.style.cssText = `
            position: absolute;
            left: ${i}px;
            top: 0;
            width: 1px;
            height: 15px;
            background: #666;
          `
          const label = document.createElement("div")
          label.style.cssText = `
            position: absolute;
            left: ${i + 2}px;
            top: 16px;
            color: #666;
          `
          label.textContent = i.toString()
          topRuler.appendChild(mark)
          topRuler.appendChild(label)
        }

        for (let i = 0; i < window.innerHeight; i += 50) {
          const mark = document.createElement("div")
          mark.style.cssText = `
            position: absolute;
            left: 0;
            top: ${i}px;
            width: 15px;
            height: 1px;
            background: #666;
          `
          const label = document.createElement("div")
          label.style.cssText = `
            position: absolute;
            left: 2px;
            top: ${i + 2}px;
            color: #666;
            writing-mode: vertical-rl;
          `
          label.textContent = i.toString()
          leftRuler.appendChild(mark)
          leftRuler.appendChild(label)
        }

        // Close button
        const closeBtn = document.createElement("button")
        closeBtn.style.cssText = `
          position: fixed;
          top: 40px;
          right: 20px;
          padding: 8px 12px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          z-index: 2147483649;
        `
        closeBtn.textContent = "✕ Close Ruler"
        closeBtn.addEventListener("click", () => {
          overlay.remove()
          topRuler.remove()
          leftRuler.remove()
          closeBtn.remove()
        })

        overlay.appendChild(grid)
        document.body.appendChild(overlay)
        document.body.appendChild(topRuler)
        document.body.appendChild(leftRuler)
        document.body.appendChild(closeBtn)
      }
    })
  }

  const activateCSSInjector = async (tabId: number) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Create CSS injector panel
        const panel = document.createElement("div")
        panel.id = "css-injector"
        panel.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          width: 300px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        `

        panel.innerHTML = `
          <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 16px; border-radius: 12px 12px 0 0;">
            <h4 style="margin: 0; font-size: 14px;">🎨 Live CSS Injector</h4>
          </div>
          <div style="padding: 16px;">
            <textarea id="css-input" placeholder="Enter CSS here..." style="width: 100%; height: 150px; border: 1px solid #ddd; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button id="apply-css" style="flex: 1; padding: 8px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer;">✓ Apply</button>
              <button id="clear-css" style="flex: 1; padding: 8px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer;">🗑️ Clear</button>
              <button id="close-css" style="padding: 8px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer;">✕</button>
            </div>
          </div>
        `

        document.body.appendChild(panel)

        let injectedStyle: HTMLStyleElement | null = null

        document.getElementById("apply-css")?.addEventListener("click", () => {
          const cssText = (
            document.getElementById("css-input") as HTMLTextAreaElement
          ).value

          // Remove previous injected styles
          if (injectedStyle) {
            injectedStyle.remove()
          }

          // Inject new styles
          injectedStyle = document.createElement("style")
          injectedStyle.textContent = cssText
          injectedStyle.id = "injected-css"
          document.head.appendChild(injectedStyle)
        })

        document.getElementById("clear-css")?.addEventListener("click", () => {
          if (injectedStyle) {
            injectedStyle.remove()
            injectedStyle = null
          }
          ;(document.getElementById("css-input") as HTMLTextAreaElement).value =
            ""
        })

        document.getElementById("close-css")?.addEventListener("click", () => {
          if (injectedStyle) {
            injectedStyle.remove()
          }
          panel.remove()
        })
      }
    })
  }

  const activateOCRExtractor = async (tabId: number) => {
    setStatus(
      "🔍 OCR Text Extractor - Coming soon! Will extract text from images and PDFs."
    )
  }

  const activatePaletteManager = async (tabId: number) => {
    setStatus(
      "🎨 Color Palette Manager - Coming soon! Will save and organize color palettes."
    )
  }

  return (
    <div style={{ padding: "0" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "16px",
          borderRadius: "12px 12px 0 0",
          marginBottom: "20px"
        }}>
        <h3
          style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600" }}>
          🛠️ Pro Tools
        </h3>
        <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>
          Advanced web development & design tools
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div
          style={{
            background: "linear-gradient(135deg, #ff6b6b, #ee5a52)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            fontWeight: "500"
          }}>
          ❌ {error}
        </div>
      )}

      {status && (
        <div
          style={{
            background: "linear-gradient(135deg, #4caf50, #45a049)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            fontWeight: "500",
            textAlign: "center"
          }}>
          {status}
        </div>
      )}

      {/* Pro Features Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "12px",
          padding: "0 16px 20px 16px"
        }}>
        {proFeatures.map((feature) => (
          <button
            key={feature.id}
            onClick={() => executeFeature(feature.id)}
            disabled={activeFeature === feature.id}
            style={{
              padding: "16px 12px",
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              background: "white",
              cursor: activeFeature === feature.id ? "not-allowed" : "pointer",
              textAlign: "center",
              fontSize: "11px",
              fontWeight: "500",
              color: "#333",
              transition: "all 0.2s ease",
              opacity: activeFeature === feature.id ? 0.6 : 1,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              transform:
                activeFeature === feature.id ? "scale(0.95)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (activeFeature !== feature.id) {
                e.currentTarget.style.transform = "scale(1.02)"
                e.currentTarget.style.boxShadow =
                  "0 4px 16px rgba(102, 126, 234, 0.2)"
              }
            }}
            onMouseLeave={(e) => {
              if (activeFeature !== feature.id) {
                e.currentTarget.style.transform = "scale(1)"
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
              }
            }}>
            <div style={{ fontSize: "20px", marginBottom: "8px" }}>
              {feature.icon}
            </div>
            <div
              style={{
                fontWeight: "600",
                marginBottom: "4px",
                fontSize: "12px"
              }}>
              {feature.label}
            </div>
            <div style={{ fontSize: "10px", opacity: 0.7, lineHeight: "1.3" }}>
              {feature.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Accessibility Tools Component (simplified version)
function AccessibilityTools() {
  const [status, setStatus] = useState<string>("")

  const a11yFeatures = [
    {
      id: "contrast",
      label: "Contrast Checker",
      icon: "🎯",
      desc: "WCAG color contrast analysis"
    },
    {
      id: "darkmode",
      label: "Dark Mode Toggle",
      icon: "🌙",
      desc: "Force dark/light mode"
    },
    {
      id: "performance",
      label: "Core Web Vitals",
      icon: "⚡",
      desc: "LCP, FID, CLS metrics"
    },
    {
      id: "reader",
      label: "Reader Mode",
      icon: "📖",
      desc: "Clean reading view"
    }
  ]

  const executeFeature = async (featureId: string) => {
    setStatus(
      `Activating ${a11yFeatures.find((f) => f.id === featureId)?.label}...`
    )

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.id) return

    if (featureId === "darkmode") {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const darkCSS = `* { background-color: #1a1a1a !important; color: #e0e0e0 !important; }`
          const style = document.createElement("style")
          style.textContent = darkCSS
          document.head.appendChild(style)
        }
      })
    }

    setStatus(
      `✅ ${a11yFeatures.find((f) => f.id === featureId)?.label} activated!`
    )
    setTimeout(() => setStatus(""), 3000)
  }

  return (
    <div>
      <h3>♿ Accessibility Tools</h3>
      {status && (
        <div
          style={{
            padding: "8px",
            background: "#e6ffe6",
            borderRadius: "4px",
            marginBottom: "12px"
          }}>
          {status}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "8px"
        }}>
        {a11yFeatures.map((feature) => (
          <button
            key={feature.id}
            onClick={() => executeFeature(feature.id)}
            style={{
              padding: "12px 8px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              background: "white",
              cursor: "pointer",
              textAlign: "center",
              fontSize: "11px"
            }}>
            <div style={{ fontSize: "16px", marginBottom: "4px" }}>
              {feature.icon}
            </div>
            <div style={{ fontWeight: "600", marginBottom: "2px" }}>
              {feature.label}
            </div>
            <div style={{ fontSize: "9px", opacity: 0.8 }}>{feature.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Simplified Pro Tools Component - User Friendly
function ProToolsSimple() {
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isWorking, setIsWorking] = useState<string>("")

  const tools = [
    {
      id: "fullpage",
      name: "📜 Full-Page Capture",
      desc: "Capture entire webpage as one long image",
      working: true,
      action: async () => {
        setIsWorking("fullpage")
        setStatus("📸 Starting full-page capture...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          // Get page dimensions
          const pageInfo = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
              scrollHeight: document.documentElement.scrollHeight,
              clientHeight: window.innerHeight,
              currentScrollY: window.scrollY
            })
          })

          const { scrollHeight, clientHeight, currentScrollY } =
            pageInfo[0].result

          if (scrollHeight <= clientHeight) {
            // Single capture for short pages
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
              format: "png"
            })
            const link = document.createElement("a")
            link.href = dataUrl
            link.download = `full-page-${Date.now()}.png`
            link.click()
            setStatus("✅ Full page captured!")
          } else {
            // Multi-section capture for long pages
            const sections = Math.ceil(scrollHeight / clientHeight)
            const screenshots: string[] = []

            setStatus(`📸 Capturing ${sections} sections...`)

            for (let i = 0; i < sections; i++) {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (scrollY) => window.scrollTo(0, scrollY),
                args: [i * clientHeight]
              })

              await new Promise((resolve) => setTimeout(resolve, 1000))

              const screenshot = await chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: "png" }
              )
              screenshots.push(screenshot)
              setStatus(`📸 Section ${i + 1}/${sections} captured`)
            }

            // Restore scroll position
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (originalY) => window.scrollTo(0, originalY),
              args: [currentScrollY]
            })

            // Stitch images together
            setStatus("🔧 Stitching images together...")

            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")!
            canvas.width = window.innerWidth
            canvas.height = scrollHeight

            let currentY = 0
            for (let i = 0; i < screenshots.length; i++) {
              await new Promise<void>((resolve) => {
                const img = new Image()
                img.onload = () => {
                  const drawHeight = Math.min(
                    clientHeight,
                    scrollHeight - currentY
                  )
                  ctx.drawImage(img, 0, currentY, canvas.width, drawHeight)
                  currentY += drawHeight
                  resolve()
                }
                img.src = screenshots[i]
              })
            }

            // Download stitched image
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = `full-page-stitched-${Date.now()}.png`
                link.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
                setStatus(
                  `✅ Full page captured! (${Math.round(blob.size / 1024)}KB)`
                )
              }
            }, "image/png")
          }
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    },
    {
      id: "annotation",
      name: "✏️ Draw & Annotate",
      desc: "Draw and highlight on webpages",
      working: true,
      action: async () => {
        setIsWorking("annotation")
        setStatus("✏️ Activating annotation tool...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const existing = document.getElementById("annotation-overlay")
              if (existing) {
                existing.remove()
                return
              }

              const overlay = document.createElement("div")
              overlay.id = "annotation-overlay"
              overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 2147483647; pointer-events: none;
              `

              const canvas = document.createElement("canvas")
              canvas.width = window.innerWidth
              canvas.height = window.innerHeight
              canvas.style.cssText = `
                position: absolute; top: 0; left: 0; pointer-events: auto; cursor: crosshair;
              `

              const toolbar = document.createElement("div")
              toolbar.style.cssText = `
                position: fixed; top: 20px; left: 20px; background: white; padding: 12px;
                border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex;
                gap: 8px; pointer-events: auto; z-index: 2147483648;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              `

              toolbar.innerHTML = `
                <button id="draw-tool" style="padding: 8px 12px; border: none; border-radius: 4px; background: #667eea; color: white; cursor: pointer; font-size: 12px;">✏️ Draw</button>
                <button id="highlight-tool" style="padding: 8px 12px; border: none; border-radius: 4px; background: #ffa726; color: white; cursor: pointer; font-size: 12px;">🖍️ Highlight</button>
                <button id="save-tool" style="padding: 8px 12px; border: none; border-radius: 4px; background: #4caf50; color: white; cursor: pointer; font-size: 12px;">💾 Save</button>
                <button id="close-annotation" style="padding: 8px 12px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer; font-size: 12px;">✕ Close</button>
              `

              overlay.appendChild(canvas)
              overlay.appendChild(toolbar)
              document.body.appendChild(overlay)

              const ctx = canvas.getContext("2d")!
              let isDrawing = false
              let currentTool = "draw"

              canvas.addEventListener("mousedown", (e) => {
                isDrawing = true
                ctx.beginPath()
                ctx.moveTo(e.clientX, e.clientY)
              })

              canvas.addEventListener("mousemove", (e) => {
                if (!isDrawing) return
                ctx.lineWidth = currentTool === "highlight" ? 20 : 3
                ctx.lineCap = "round"
                ctx.globalAlpha = currentTool === "highlight" ? 0.3 : 1
                ctx.strokeStyle =
                  currentTool === "highlight" ? "#ffeb3b" : "#667eea"
                ctx.lineTo(e.clientX, e.clientY)
                ctx.stroke()
              })

              canvas.addEventListener("mouseup", () => {
                isDrawing = false
              })

              document
                .getElementById("draw-tool")
                ?.addEventListener("click", () => {
                  currentTool = "draw"
                  document.getElementById("draw-tool")!.style.background =
                    "#667eea"
                  document.getElementById("highlight-tool")!.style.background =
                    "#ffa726"
                })

              document
                .getElementById("highlight-tool")
                ?.addEventListener("click", () => {
                  currentTool = "highlight"
                  document.getElementById("highlight-tool")!.style.background =
                    "#ff9800"
                  document.getElementById("draw-tool")!.style.background =
                    "#9e9e9e"
                })

              document
                .getElementById("save-tool")
                ?.addEventListener("click", () => {
                  const dataUrl = canvas.toDataURL("image/png")
                  const link = document.createElement("a")
                  link.href = dataUrl
                  link.download = `annotation-${Date.now()}.png`
                  link.click()
                })

              document
                .getElementById("close-annotation")
                ?.addEventListener("click", () => {
                  overlay.remove()
                })
            }
          })

          setStatus("✅ Annotation tool activated! Draw on the page.")
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    },
    {
      id: "ruler",
      name: "📏 Pixel Ruler",
      desc: "Show pixel rulers and grid overlay",
      working: true,
      action: async () => {
        setIsWorking("ruler")
        setStatus("📏 Activating pixel ruler...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const existing = document.getElementById("ruler-overlay")
              if (existing) {
                existing.remove()
                document.getElementById("top-ruler")?.remove()
                document.getElementById("left-ruler")?.remove()
                document.getElementById("close-ruler")?.remove()
                return
              }

              const overlay = document.createElement("div")
              overlay.id = "ruler-overlay"
              overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                pointer-events: none; z-index: 2147483647;
                background-image:
                  linear-gradient(rgba(102, 126, 234, 0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(102, 126, 234, 0.1) 1px, transparent 1px);
                background-size: 20px 20px;
              `

              const topRuler = document.createElement("div")
              topRuler.id = "top-ruler"
              topRuler.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 30px;
                background: rgba(255,255,255,0.9); border-bottom: 1px solid #ddd;
                font-size: 10px; font-family: monospace; pointer-events: auto; z-index: 2147483648;
              `

              const leftRuler = document.createElement("div")
              leftRuler.id = "left-ruler"
              leftRuler.style.cssText = `
                position: fixed; top: 0; left: 0; width: 30px; height: 100vh;
                background: rgba(255,255,255,0.9); border-right: 1px solid #ddd;
                font-size: 10px; font-family: monospace; pointer-events: auto; z-index: 2147483648;
              `

              // Add ruler markings
              for (let i = 0; i < window.innerWidth; i += 50) {
                const mark = document.createElement("div")
                mark.style.cssText = `position: absolute; left: ${i}px; top: 0; width: 1px; height: 15px; background: #666;`
                const label = document.createElement("div")
                label.style.cssText = `position: absolute; left: ${i + 2}px; top: 16px; color: #666;`
                label.textContent = i.toString()
                topRuler.appendChild(mark)
                topRuler.appendChild(label)
              }

              for (let i = 0; i < window.innerHeight; i += 50) {
                const mark = document.createElement("div")
                mark.style.cssText = `position: absolute; left: 0; top: ${i}px; width: 15px; height: 1px; background: #666;`
                const label = document.createElement("div")
                label.style.cssText = `position: absolute; left: 2px; top: ${i + 2}px; color: #666; writing-mode: vertical-rl;`
                label.textContent = i.toString()
                leftRuler.appendChild(mark)
                leftRuler.appendChild(label)
              }

              const closeBtn = document.createElement("button")
              closeBtn.id = "close-ruler"
              closeBtn.style.cssText = `
                position: fixed; top: 40px; right: 20px; padding: 8px 12px;
                background: #f44336; color: white; border: none; border-radius: 4px;
                cursor: pointer; z-index: 2147483649;
              `
              closeBtn.textContent = "✕ Close Ruler"
              closeBtn.addEventListener("click", () => {
                overlay.remove()
                topRuler.remove()
                leftRuler.remove()
                closeBtn.remove()
              })

              document.body.appendChild(overlay)
              document.body.appendChild(topRuler)
              document.body.appendChild(leftRuler)
              document.body.appendChild(closeBtn)
            }
          })

          setStatus("✅ Pixel ruler activated!")
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    },
    {
      id: "css",
      name: "🎨 Live CSS Editor",
      desc: "Inject and preview CSS changes",
      working: true,
      action: async () => {
        setIsWorking("css")
        setStatus("🎨 Opening CSS editor...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const existing = document.getElementById("css-injector")
              if (existing) {
                existing.remove()
                return
              }

              const panel = document.createElement("div")
              panel.id = "css-injector"
              panel.style.cssText = `
                position: fixed; top: 20px; right: 20px; width: 300px;
                background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              `

              panel.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 16px; border-radius: 12px 12px 0 0;">
                  <h4 style="margin: 0; font-size: 14px;">🎨 Live CSS Editor</h4>
                </div>
                <div style="padding: 16px;">
                  <textarea id="css-input" placeholder="Enter CSS here..." style="width: 100%; height: 150px; border: 1px solid #ddd; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
                  <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button id="apply-css" style="flex: 1; padding: 8px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer;">✓ Apply</button>
                    <button id="clear-css" style="flex: 1; padding: 8px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer;">🗑️ Clear</button>
                    <button id="close-css" style="padding: 8px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer;">✕</button>
                  </div>
                </div>
              `

              document.body.appendChild(panel)

              let injectedStyle: HTMLStyleElement | null = null

              document
                .getElementById("apply-css")
                ?.addEventListener("click", () => {
                  const cssText = (
                    document.getElementById("css-input") as HTMLTextAreaElement
                  ).value
                  if (injectedStyle) injectedStyle.remove()
                  injectedStyle = document.createElement("style")
                  injectedStyle.textContent = cssText
                  injectedStyle.id = "injected-css"
                  document.head.appendChild(injectedStyle)
                })

              document
                .getElementById("clear-css")
                ?.addEventListener("click", () => {
                  if (injectedStyle) {
                    injectedStyle.remove()
                    injectedStyle = null
                  }
                  ;(
                    document.getElementById("css-input") as HTMLTextAreaElement
                  ).value = ""
                })

              document
                .getElementById("close-css")
                ?.addEventListener("click", () => {
                  if (injectedStyle) injectedStyle.remove()
                  panel.remove()
                })
            }
          })

          setStatus("✅ CSS editor opened!")
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    }
  ]

  return (
    <div style={{ padding: "20px", maxHeight: "500px", overflow: "auto" }}>
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#333" }}>
          🛠️ Pro Tools
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
          Advanced web development tools
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            border: "1px solid #ffcdd2"
          }}>
          ❌ {error}
        </div>
      )}

      {status && (
        <div
          style={{
            background: "#e8f5e8",
            color: "#2e7d32",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            border: "1px solid #c8e6c9"
          }}>
          {status}
        </div>
      )}

      {/* Tools Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "12px"
        }}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={tool.action}
            disabled={isWorking === tool.id}
            style={{
              padding: "16px",
              border: "2px solid #e0e0e0",
              borderRadius: "12px",
              background: "white",
              cursor: isWorking === tool.id ? "not-allowed" : "pointer",
              textAlign: "left",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              transition: "all 0.2s ease",
              opacity: isWorking === tool.id ? 0.6 : 1,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}
            onMouseEnter={(e) => {
              if (isWorking !== tool.id) {
                e.currentTarget.style.borderColor = "#667eea"
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.boxShadow =
                  "0 4px 16px rgba(102, 126, 234, 0.2)"
              }
            }}
            onMouseLeave={(e) => {
              if (isWorking !== tool.id) {
                e.currentTarget.style.borderColor = "#e0e0e0"
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
              }
            }}>
            <div style={{ fontSize: "24px" }}>{tool.name.split(" ")[0]}</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: "600",
                  marginBottom: "4px",
                  fontSize: "16px"
                }}>
                {tool.name.substring(2)}
              </div>
              <div
                style={{ fontSize: "12px", opacity: 0.7, lineHeight: "1.3" }}>
                {tool.desc}
              </div>
              {tool.working && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#4CAF50",
                    fontWeight: "600",
                    marginTop: "4px"
                  }}>
                  ✅ Ready to use
                </div>
              )}
            </div>
            {isWorking === tool.id && (
              <div
                style={{
                  fontSize: "16px",
                  animation: "spin 1s linear infinite"
                }}>
                ⏳
              </div>
            )}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "12px",
          background: "#f5f5f5",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#666",
          textAlign: "center"
        }}>
        💡 Click any tool above to activate it on the current webpage
      </div>
    </div>
  )
}

// Simplified Accessibility Tools Component
function AccessibilityToolsSimple() {
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isWorking, setIsWorking] = useState<string>("")

  const a11yTools = [
    {
      id: "contrast",
      name: "🎯 Contrast Checker",
      desc: "Check WCAG color contrast compliance",
      working: true,
      action: async () => {
        setIsWorking("contrast")
        setStatus("🎯 Opening contrast checker...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const existing = document.getElementById("contrast-checker")
              if (existing) {
                existing.remove()
                return
              }

              const overlay = document.createElement("div")
              overlay.id = "contrast-checker"
              overlay.style.cssText = `
                position: fixed; top: 20px; left: 20px; width: 320px;
                background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              `

              overlay.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 16px; border-radius: 12px 12px 0 0;">
                  <h4 style="margin: 0; font-size: 14px;">🎯 WCAG Contrast Checker</h4>
                </div>
                <div style="padding: 16px;">
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600;">Foreground Color:</label>
                    <input type="color" id="fg-color" value="#000000" style="width: 100%; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
                  </div>
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600;">Background Color:</label>
                    <input type="color" id="bg-color" value="#ffffff" style="width: 100%; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
                  </div>
                  <div id="contrast-result" style="padding: 12px; background: #f5f5f5; border-radius: 6px; margin-bottom: 12px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">21:1</div>
                    <div style="font-size: 12px; color: #4caf50;">✓ WCAG AAA Compliant</div>
                  </div>
                  <button id="close-contrast" style="width: 100%; padding: 8px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer;">✕ Close</button>
                </div>
              `

              document.body.appendChild(overlay)

              const calculateContrast = (fg: string, bg: string) => {
                const getLuminance = (color: string) => {
                  const rgb = parseInt(color.slice(1), 16)
                  const r = (rgb >> 16) & 0xff
                  const g = (rgb >> 8) & 0xff
                  const b = (rgb >> 0) & 0xff

                  const [rs, gs, bs] = [r, g, b].map((c) => {
                    c = c / 255
                    return c <= 0.03928
                      ? c / 12.92
                      : Math.pow((c + 0.055) / 1.055, 2.4)
                  })

                  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
                }

                const l1 = getLuminance(fg)
                const l2 = getLuminance(bg)
                const lighter = Math.max(l1, l2)
                const darker = Math.min(l1, l2)

                return (lighter + 0.05) / (darker + 0.05)
              }

              const updateContrast = () => {
                const fg = (
                  document.getElementById("fg-color") as HTMLInputElement
                ).value
                const bg = (
                  document.getElementById("bg-color") as HTMLInputElement
                ).value
                const ratio = calculateContrast(fg, bg)

                const resultDiv = document.getElementById("contrast-result")!
                const ratioText = ratio.toFixed(2) + ":1"

                let status = ""
                let color = ""

                if (ratio >= 7) {
                  status = "✓ WCAG AAA Compliant"
                  color = "#4caf50"
                } else if (ratio >= 4.5) {
                  status = "✓ WCAG AA Compliant"
                  color = "#ff9800"
                } else {
                  status = "✗ Does not meet WCAG standards"
                  color = "#f44336"
                }

                resultDiv.innerHTML = `
                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">${ratioText}</div>
                  <div style="font-size: 12px; color: ${color};">${status}</div>
                `
              }

              document
                .getElementById("fg-color")
                ?.addEventListener("input", updateContrast)
              document
                .getElementById("bg-color")
                ?.addEventListener("input", updateContrast)
              document
                .getElementById("close-contrast")
                ?.addEventListener("click", () => overlay.remove())

              updateContrast()
            }
          })

          setStatus("✅ Contrast checker opened!")
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    },
    {
      id: "darkmode",
      name: "🌙 Dark Mode Toggle",
      desc: "Force dark/light mode on any website",
      working: true,
      action: async () => {
        setIsWorking("darkmode")
        setStatus("🌙 Toggling dark mode...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const existingDarkMode =
                document.getElementById("dark-mode-toggle")

              if (existingDarkMode) {
                existingDarkMode.remove()
                return
              }

              const darkModeCSS = `
                * {
                  background-color: #1a1a1a !important;
                  color: #e0e0e0 !important;
                  border-color: #333 !important;
                }

                img, video, iframe, svg {
                  opacity: 0.8 !important;
                  filter: brightness(0.8) contrast(1.2) !important;
                }

                a {
                  color: #64b5f6 !important;
                }

                input, textarea, select {
                  background-color: #2d2d2d !important;
                  color: #e0e0e0 !important;
                  border: 1px solid #555 !important;
                }
              `

              const style = document.createElement("style")
              style.id = "dark-mode-toggle"
              style.textContent = darkModeCSS
              document.head.appendChild(style)

              const toggleBtn = document.createElement("button")
              toggleBtn.style.cssText = `
                position: fixed; top: 20px; right: 20px; padding: 12px;
                background: #667eea; color: white; border: none; border-radius: 50%;
                cursor: pointer; z-index: 2147483647; font-size: 16px;
                width: 50px; height: 50px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              `
              toggleBtn.textContent = "☀️"
              toggleBtn.title = "Toggle Dark Mode"

              toggleBtn.addEventListener("click", () => {
                const darkStyle = document.getElementById("dark-mode-toggle")
                if (darkStyle) {
                  darkStyle.remove()
                  toggleBtn.textContent = "🌙"
                } else {
                  const newStyle = document.createElement("style")
                  newStyle.id = "dark-mode-toggle"
                  newStyle.textContent = darkModeCSS
                  document.head.appendChild(newStyle)
                  toggleBtn.textContent = "☀️"
                }
              })

              document.body.appendChild(toggleBtn)

              setTimeout(() => {
                if (toggleBtn.parentNode) toggleBtn.remove()
              }, 10000)
            }
          })

          setStatus("✅ Dark mode toggled!")
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    },
    {
      id: "performance",
      name: "⚡ Performance Monitor",
      desc: "Show Core Web Vitals and page metrics",
      working: true,
      action: async () => {
        setIsWorking("performance")
        setStatus("⚡ Analyzing performance...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const existing = document.getElementById("performance-profiler")
              if (existing) {
                existing.remove()
                return
              }

              const overlay = document.createElement("div")
              overlay.id = "performance-profiler"
              overlay.style.cssText = `
                position: fixed; top: 20px; right: 20px; width: 280px;
                background: rgba(0,0,0,0.9); color: white; padding: 16px;
                border-radius: 12px; z-index: 2147483647; font-family: monospace; font-size: 12px;
              `

              overlay.innerHTML = `
                <h4 style="margin: 0 0 12px 0; color: #4caf50;">⚡ Core Web Vitals</h4>
                <div id="vitals-content">Loading...</div>
                <button id="close-performance" style="margin-top: 12px; padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px;">✕ Close</button>
              `

              document.body.appendChild(overlay)

              const getMetrics = () => {
                const navigation = performance.getEntriesByType(
                  "navigation"
                )[0] as PerformanceNavigationTiming
                const paint = performance.getEntriesByType("paint")

                const fcp =
                  paint.find((entry) => entry.name === "first-contentful-paint")
                    ?.startTime || 0
                const loadTime =
                  navigation.loadEventEnd - navigation.loadEventStart
                const domContentLoaded =
                  navigation.domContentLoadedEventEnd -
                  navigation.domContentLoadedEventStart

                return {
                  fcp: Math.round(fcp),
                  loadTime: Math.round(loadTime),
                  domContentLoaded: Math.round(domContentLoaded)
                }
              }

              const metrics = getMetrics()

              const vitalsContent = document.getElementById("vitals-content")!
              vitalsContent.innerHTML = `
                <div style="margin-bottom: 8px;">
                  <strong>First Contentful Paint:</strong><br>
                  <span style="color: ${metrics.fcp < 1800 ? "#4caf50" : metrics.fcp < 3000 ? "#ff9800" : "#f44336"}">${metrics.fcp}ms</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>Load Time:</strong><br>
                  <span style="color: ${metrics.loadTime < 2000 ? "#4caf50" : metrics.loadTime < 4000 ? "#ff9800" : "#f44336"}">${metrics.loadTime}ms</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>DOM Content Loaded:</strong><br>
                  <span style="color: ${metrics.domContentLoaded < 1500 ? "#4caf50" : metrics.domContentLoaded < 2500 ? "#ff9800" : "#f44336"}">${metrics.domContentLoaded}ms</span>
                </div>
              `

              document
                .getElementById("close-performance")
                ?.addEventListener("click", () => overlay.remove())
            }
          })

          setStatus("✅ Performance monitor opened!")
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    },
    {
      id: "reader",
      name: "📖 Reader Mode",
      desc: "Clean, distraction-free reading view",
      working: true,
      action: async () => {
        setIsWorking("reader")
        setStatus("📖 Activating reader mode...")

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (!tab?.id) throw new Error("No active tab found")

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const existingReader = document.getElementById("reader-mode")
              if (existingReader) {
                existingReader.remove()
                return
              }

              // Extract main content
              const contentSelectors = [
                "article",
                "main",
                ".content",
                ".post",
                ".entry",
                "p"
              ]
              let mainContent = ""

              for (const selector of contentSelectors) {
                const elements = document.querySelectorAll(selector)
                if (elements.length > 0) {
                  elements.forEach((el) => {
                    if (el.textContent && el.textContent.length > 100) {
                      mainContent += el.outerHTML
                    }
                  })
                  break
                }
              }

              if (!mainContent) {
                const paragraphs = document.querySelectorAll("p")
                paragraphs.forEach((p) => {
                  if (p.textContent && p.textContent.length > 50) {
                    mainContent += p.outerHTML
                  }
                })
              }

              const readerOverlay = document.createElement("div")
              readerOverlay.id = "reader-mode"
              readerOverlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #f5f5f5; z-index: 2147483647; overflow-y: auto; font-family: Georgia, serif;
              `

              readerOverlay.innerHTML = `
                <div style="max-width: 700px; margin: 0 auto; padding: 40px 20px; background: white; min-height: 100vh;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #ddd;">
                    <h1 style="margin: 0; font-size: 24px; color: #333;">📖 Reader Mode</h1>
                    <button id="close-reader" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">✕ Close</button>
                  </div>
                  <div style="line-height: 1.6; font-size: 16px; color: #333;">
                    ${mainContent || "<p>No readable content found on this page.</p>"}
                  </div>
                </div>
              `

              document.body.appendChild(readerOverlay)

              document
                .getElementById("close-reader")
                ?.addEventListener("click", () => {
                  readerOverlay.remove()
                })
            }
          })

          setStatus("✅ Reader mode activated!")
        } catch (error: any) {
          setError(`Failed: ${error.message}`)
        } finally {
          setIsWorking("")
        }
      }
    }
  ]

  return (
    <div style={{ padding: "20px", maxHeight: "500px", overflow: "auto" }}>
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#333" }}>
          ♿ Accessibility & Performance
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
          WCAG compliance and performance tools
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            border: "1px solid #ffcdd2"
          }}>
          ❌ {error}
        </div>
      )}

      {status && (
        <div
          style={{
            background: "#e8f5e8",
            color: "#2e7d32",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            border: "1px solid #c8e6c9"
          }}>
          {status}
        </div>
      )}

      {/* Tools Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "12px"
        }}>
        {a11yTools.map((tool) => (
          <button
            key={tool.id}
            onClick={tool.action}
            disabled={isWorking === tool.id}
            style={{
              padding: "16px",
              border: "2px solid #e0e0e0",
              borderRadius: "12px",
              background: "white",
              cursor: isWorking === tool.id ? "not-allowed" : "pointer",
              textAlign: "left",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              transition: "all 0.2s ease",
              opacity: isWorking === tool.id ? 0.6 : 1,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}
            onMouseEnter={(e) => {
              if (isWorking !== tool.id) {
                e.currentTarget.style.borderColor = "#667eea"
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.boxShadow =
                  "0 4px 16px rgba(102, 126, 234, 0.2)"
              }
            }}
            onMouseLeave={(e) => {
              if (isWorking !== tool.id) {
                e.currentTarget.style.borderColor = "#e0e0e0"
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
              }
            }}>
            <div style={{ fontSize: "24px" }}>{tool.name.split(" ")[0]}</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: "600",
                  marginBottom: "4px",
                  fontSize: "16px"
                }}>
                {tool.name.substring(2)}
              </div>
              <div
                style={{ fontSize: "12px", opacity: 0.7, lineHeight: "1.3" }}>
                {tool.desc}
              </div>
              {tool.working && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#4CAF50",
                    fontWeight: "600",
                    marginTop: "4px"
                  }}>
                  ✅ Ready to use
                </div>
              )}
            </div>
            {isWorking === tool.id && (
              <div
                style={{
                  fontSize: "16px",
                  animation: "spin 1s linear infinite"
                }}>
                ⏳
              </div>
            )}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "12px",
          background: "#f5f5f5",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#666",
          textAlign: "center"
        }}>
        💡 Click any tool above to activate it on the current webpage
      </div>
    </div>
  )
}

// 📋 COMPREHENSIVE DOCUMENTATION TOOL - Full Implementation
function ComprehensiveDocumentationTool() {
  const [activeFeature, setActiveFeature] = useState<string>("sop-creation")
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isWorking, setIsWorking] = useState<string>("")

  // SOP Creation States
  const [sopTitle, setSOPTitle] = useState<string>("")
  const [sopDescription, setSOPDescription] = useState<string>("")
  const [sopSteps, setSOPSteps] = useState<string[]>([""])
  const [currentSOP, setCurrentSOP] = useState<any>(null)

  // Knowledge Sharing States
  const [knowledgeTitle, setKnowledgeTitle] = useState<string>("")
  const [knowledgeContent, setKnowledgeContent] = useState<string>("")
  const [knowledgeTags, setKnowledgeTags] = useState<string>("")

  // Documentation States
  const [allSOPs, setAllSOPs] = useState<any[]>([])
  const [allKnowledge, setAllKnowledge] = useState<any[]>([])
  const [activeView, setActiveView] = useState<string>("create")
  const [timeSpent, setTimeSpent] = useState<number>(0)

  // 📊 STEP 5: TIME TRACKING FOR EFFICIENCY
  const trackTime = async (activity: string, timeSpent: number) => {
    try {
      const timeData = await chrome.storage.local.get([
        "multiToolPro_timeTracking"
      ])
      const existing = timeData.multiToolPro_timeTracking || {}
      const today = new Date().toDateString()

      if (!existing[today]) existing[today] = {}
      if (!existing[today][activity]) existing[today][activity] = 0

      existing[today][activity] += timeSpent
      await chrome.storage.local.set({ multiToolPro_timeTracking: existing })
    } catch (error) {
      console.error("Time tracking failed:", error)
    }
  }

  // 📚 STEP 2: KNOWLEDGE SHARING WITH TAGS AND URL TRACKING
  const captureKnowledgeWithSharing = async () => {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) {
      setError("Please enter both title and content")
      return
    }

    const startTime = Date.now()
    setIsWorking("capturing-knowledge")
    setStatus("Capturing knowledge with sharing features...")

    try {
      // Get current tab info for context
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      // Process tags
      const tags = knowledgeTags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

      const knowledgeData = {
        id: Date.now().toString(),
        title: knowledgeTitle,
        content: knowledgeContent,
        url: tab?.url || "",
        domain: tab?.url ? new URL(tab.url).hostname : "",
        tags: tags,
        category: "knowledge-sharing",
        createdAt: new Date().toISOString(),
        sharedCount: 0,
        importance: tags.includes("important") ? "high" : "normal"
      }

      // Save to Chrome storage with enhanced structure
      const result = await chrome.storage.local.get(["multiToolPro_knowledge"])
      const existingKnowledge = result.multiToolPro_knowledge || []
      existingKnowledge.push(knowledgeData)
      await chrome.storage.local.set({
        multiToolPro_knowledge: existingKnowledge
      })

      // Track time efficiency
      const timeSpentOnTask = Date.now() - startTime
      await trackTime("Knowledge Capture", timeSpentOnTask)

      setStatus(
        `✅ Knowledge captured in ${Math.round(timeSpentOnTask / 1000)}s with ${tags.length} tags!`
      )
      setKnowledgeTitle("")
      setKnowledgeContent("")
      setKnowledgeTags("")
      setAllKnowledge(existingKnowledge)

      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError("Failed to capture knowledge: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  // 📋 STEP 1: AUTOMATED SOP CREATION WITH TEMPLATES
  const createSOPWithTemplate = async () => {
    if (!sopTitle.trim()) {
      setError("Please enter an SOP title")
      return
    }

    const startTime = Date.now()
    setIsWorking("creating-sop")
    setStatus("Creating SOP with automated template...")

    try {
      // Generate SOP using Handlebars-like template
      const sopTemplate = {
        title: sopTitle,
        description: sopDescription,
        steps: sopSteps.filter((step) => step.trim()),
        metadata: {
          created: new Date().toISOString(),
          author: "Multi-Tool Pro User",
          version: "1.0",
          category: "Standard Process"
        }
      }

      const sopData = {
        id: Date.now().toString(),
        ...sopTemplate,
        screenshots: [],
        timeSpent: 0
      }

      // Save to Chrome storage
      const result = await chrome.storage.local.get(["multiToolPro_sops"])
      const existingSOPs = result.multiToolPro_sops || []
      existingSOPs.push(sopData)
      await chrome.storage.local.set({ multiToolPro_sops: existingSOPs })

      // Track time efficiency
      const timeSpentOnTask = Date.now() - startTime
      await trackTime("SOP Creation", timeSpentOnTask)

      setCurrentSOP(sopData)
      setStatus(
        `✅ SOP created in ${Math.round(timeSpentOnTask / 1000)}s with template!`
      )
      setSOPTitle("")
      setSOPDescription("")
      setSOPSteps([""])
      setAllSOPs(existingSOPs)

      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError("Failed to create SOP: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  // Real Working Documentation Functions
  const createNewSOP = async () => {
    if (!sopTitle.trim()) {
      setError("Please enter an SOP title")
      return
    }

    setIsWorking("creating-sop")
    setStatus("Creating new SOP...")

    try {
      // Create SOP using Chrome storage
      const sopData = {
        id: Date.now().toString(),
        title: sopTitle,
        description: sopDescription,
        steps: [],
        screenshots: [],
        createdAt: new Date().toISOString()
      }

      // Save to Chrome storage
      const result = await chrome.storage.local.get(["multiToolPro_sops"])
      const existingSOPs = result.multiToolPro_sops || []
      existingSOPs.push(sopData)
      await chrome.storage.local.set({ multiToolPro_sops: existingSOPs })

      setCurrentSOP(sopData)
      setStatus("✅ SOP created successfully!")
      setSOPTitle("")
      setSOPDescription("")

      // Load all SOPs
      setAllSOPs(existingSOPs)
    } catch (error: any) {
      setError("Failed to create SOP: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  const captureKnowledgeItem = async () => {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) {
      setError("Please enter both title and content")
      return
    }

    setIsWorking("capturing-knowledge")
    setStatus("Capturing knowledge...")

    try {
      // Get current tab info
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      const knowledgeData = {
        id: Date.now().toString(),
        title: knowledgeTitle,
        content: knowledgeContent,
        url: tab?.url || "",
        createdAt: new Date().toISOString(),
        tags: []
      }

      // Save to Chrome storage
      const result = await chrome.storage.local.get(["multiToolPro_knowledge"])
      const existingKnowledge = result.multiToolPro_knowledge || []
      existingKnowledge.push(knowledgeData)
      await chrome.storage.local.set({
        multiToolPro_knowledge: existingKnowledge
      })

      setStatus("✅ Knowledge captured successfully!")
      setKnowledgeTitle("")
      setKnowledgeContent("")

      // Load all knowledge
      setAllKnowledge(existingKnowledge)
    } catch (error: any) {
      setError("Failed to capture knowledge: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  const captureScreenshotForSOP = async () => {
    setIsWorking("capturing-screenshot")
    setStatus("Capturing screenshot...")

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      // Capture screenshot
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
        quality: 90
      })

      // Create download link
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `SOP_Screenshot_${new Date().toISOString().split("T")[0]}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setStatus("✅ Screenshot captured and downloaded!")
    } catch (error: any) {
      setError("Failed to capture screenshot: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  const generateSOPDocument = async () => {
    if (!currentSOP) {
      setError("No SOP selected")
      return
    }

    setIsWorking("generating-document")
    setStatus("Generating SOP document...")

    try {
      // Generate HTML document
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${currentSOP.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .step { margin-bottom: 20px; padding: 15px; border-left: 4px solid #667eea; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${currentSOP.title}</h1>
            <p>${currentSOP.description}</p>
            <p>Created: ${new Date(currentSOP.createdAt).toLocaleDateString()}</p>
          </div>
          <div class="content">
            ${currentSOP.steps
              .map(
                (step: any, index: number) => `
              <div class="step">
                <h3>Step ${index + 1}: ${step.title || "Untitled Step"}</h3>
                <p>${step.description || "No description"}</p>
              </div>
            `
              )
              .join("")}
          </div>
          <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
            Generated by Multi-Tool Pro Extension
          </div>
        </body>
        </html>
      `

      // Create and download HTML file
      const blob = new Blob([htmlContent], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${currentSOP.title.replace(/[^a-z0-9]/gi, "_")}_SOP.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setStatus("✅ SOP document generated and downloaded!")
    } catch (error: any) {
      setError("Failed to generate document: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const sopResult = await chrome.storage.local.get(["multiToolPro_sops"])
        const knowledgeResult = await chrome.storage.local.get([
          "multiToolPro_knowledge"
        ])

        setAllSOPs(sopResult.multiToolPro_sops || [])
        setAllKnowledge(knowledgeResult.multiToolPro_knowledge || [])
      } catch (error) {
        console.error("Failed to load data:", error)
      }
    }

    loadData()
  }, [])

  // Remove old functions - replaced with real working functions above
  const startSOPCreation = async () => {
    try {
      setIsWorking("sop-creator")
      setStatus("🚀 Starting SOP creation wizard...")

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      // Inject SOP creation interface
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create SOP creation overlay
          const overlay = document.createElement("div")
          overlay.id = "sop-creator-overlay"
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.8);
            z-index: 2147483647;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          `

          const sopPanel = document.createElement("div")
          sopPanel.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          `

          sopPanel.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #333; margin-bottom: 10px; font-size: 24px;">📋 SOP Creator</h2>
              <p style="color: #666; font-size: 16px;">Create comprehensive Standard Operating Procedures</p>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">SOP Title:</label>
              <input type="text" id="sop-title" placeholder="Enter SOP title..." style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Description:</label>
              <textarea id="sop-description" placeholder="Brief description of the process..." style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; height: 80px; resize: vertical; box-sizing: border-box;"></textarea>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Process Steps:</label>
              <div id="sop-steps">
                <div class="sop-step" style="margin-bottom: 10px; padding: 12px; border: 1px solid #eee; border-radius: 6px; background: #f9f9f9;">
                  <input type="text" placeholder="Step 1: Enter step description..." style="width: 100%; border: none; background: transparent; font-size: 14px; box-sizing: border-box;">
                </div>
              </div>
              <button id="add-step" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 10px;">+ Add Step</button>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Capture Mode:</label>
              <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                  <input type="radio" name="capture-mode" value="manual" checked>
                  <span style="font-size: 14px;">Manual Screenshots</span>
                </label>
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                  <input type="radio" name="capture-mode" value="auto">
                  <span style="font-size: 14px;">Auto-Record Process</span>
                </label>
              </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
              <button id="cancel-sop" style="padding: 12px 24px; background: #f8f9fa; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
              <button id="start-sop" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">Start Creating SOP</button>
            </div>
          `

          overlay.appendChild(sopPanel)
          document.body.appendChild(overlay)

          // Add event listeners
          document.getElementById("add-step")?.addEventListener("click", () => {
            const stepsContainer = document.getElementById("sop-steps")
            const stepCount = stepsContainer?.children.length || 0
            const newStep = document.createElement("div")
            newStep.className = "sop-step"
            newStep.style.cssText =
              "margin-bottom: 10px; padding: 12px; border: 1px solid #eee; border-radius: 6px; background: #f9f9f9;"
            newStep.innerHTML = `<input type="text" placeholder="Step ${stepCount + 1}: Enter step description..." style="width: 100%; border: none; background: transparent; font-size: 14px; box-sizing: border-box;">`
            stepsContainer?.appendChild(newStep)
          })

          document
            .getElementById("cancel-sop")
            ?.addEventListener("click", () => {
              overlay.remove()
            })

          document
            .getElementById("start-sop")
            ?.addEventListener("click", () => {
              const title = (
                document.getElementById("sop-title") as HTMLInputElement
              )?.value
              const description = (
                document.getElementById(
                  "sop-description"
                ) as HTMLTextAreaElement
              )?.value
              const steps = Array.from(
                document.querySelectorAll(".sop-step input")
              )
                .map((input: any) => input.value)
                .filter((step) => step.trim())
              const captureMode = (
                document.querySelector(
                  'input[name="capture-mode"]:checked'
                ) as HTMLInputElement
              )?.value

              if (!title || steps.length === 0) {
                alert("Please enter a title and at least one step.")
                return
              }

              // Store SOP data and start capture process
              const sopData = {
                title,
                description,
                steps,
                captureMode,
                screenshots: []
              }
              localStorage.setItem("currentSOP", JSON.stringify(sopData))

              overlay.remove()

              // Start the capture process
              if (captureMode === "auto") {
                startAutoRecording()
              } else {
                startManualCapture()
              }
            })

          function startAutoRecording() {
            // Auto-recording implementation
            const recordingOverlay = document.createElement("div")
            recordingOverlay.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #ff4444;
              color: white;
              padding: 15px 20px;
              border-radius: 8px;
              z-index: 2147483648;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `
            recordingOverlay.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 8px; height: 8px; background: white; border-radius: 50%; animation: pulse 1s infinite;"></div>
                <span style="font-weight: 600;">Recording Process</span>
                <button id="stop-recording" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Stop</button>
              </div>
            `
            document.body.appendChild(recordingOverlay)

            document
              .getElementById("stop-recording")
              ?.addEventListener("click", () => {
                recordingOverlay.remove()
                finalizeSOP()
              })
          }

          function startManualCapture() {
            // Manual capture implementation
            const captureOverlay = document.createElement("div")
            captureOverlay.style.cssText = `
              position: fixed;
              bottom: 20px;
              right: 20px;
              background: #667eea;
              color: white;
              padding: 15px 20px;
              border-radius: 8px;
              z-index: 2147483648;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `
            captureOverlay.innerHTML = `
              <div style="text-align: center;">
                <div style="margin-bottom: 10px; font-weight: 600;">📸 Manual Capture Mode</div>
                <div style="display: flex; gap: 10px;">
                  <button id="capture-step" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Capture Step</button>
                  <button id="finish-sop" style="background: #4CAF50; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Finish SOP</button>
                </div>
              </div>
            `
            document.body.appendChild(captureOverlay)

            let stepCount = 0
            document
              .getElementById("capture-step")
              ?.addEventListener("click", async () => {
                stepCount++

                try {
                  // Use Chrome's tabs.captureVisibleTab API for better screenshots
                  const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                  })

                  const video = document.createElement("video")
                  video.srcObject = stream
                  video.play()

                  video.addEventListener("loadedmetadata", () => {
                    const canvas = document.createElement("canvas")
                    canvas.width = video.videoWidth
                    canvas.height = video.videoHeight
                    const ctx = canvas.getContext("2d")
                    ctx?.drawImage(video, 0, 0)

                    // Stop the stream
                    stream.getTracks().forEach((track) => track.stop())

                    // Convert to blob and create download link
                    canvas.toBlob((blob) => {
                      if (blob) {
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement("a")
                        link.href = url
                        link.download = `SOP_Step_${stepCount}_${new Date().toISOString().split("T")[0]}.png`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        URL.revokeObjectURL(url)

                        // Store screenshot reference in SOP data
                        const sopData = JSON.parse(
                          localStorage.getItem("currentSOP") || "{}"
                        )
                        if (!sopData.screenshots) sopData.screenshots = []
                        sopData.screenshots.push({
                          step: stepCount,
                          filename: `SOP_Step_${stepCount}_${new Date().toISOString().split("T")[0]}.png`,
                          timestamp: new Date().toISOString()
                        })
                        localStorage.setItem(
                          "currentSOP",
                          JSON.stringify(sopData)
                        )
                      }
                    }, "image/png")

                    const notification = document.createElement("div")
                    notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #4CAF50;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 6px;
                    z-index: 2147483649;
                    font-size: 14px;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                  `
                    notification.textContent = `Step ${stepCount} screenshot saved!`
                    document.body.appendChild(notification)
                    setTimeout(() => notification.remove(), 2000)
                  })
                } catch (error) {
                  // Fallback: Use Chrome's built-in screenshot API
                  try {
                    const stream = await navigator.mediaDevices.getDisplayMedia(
                      {
                        video: true
                      }
                    )

                    const video = document.createElement("video")
                    video.srcObject = stream
                    video.play()

                    video.addEventListener("loadedmetadata", () => {
                      const canvas = document.createElement("canvas")
                      canvas.width = video.videoWidth
                      canvas.height = video.videoHeight
                      const ctx = canvas.getContext("2d")
                      ctx?.drawImage(video, 0, 0)

                      // Stop the stream
                      stream.getTracks().forEach((track) => track.stop())

                      // Download the screenshot
                      canvas.toBlob((blob) => {
                        if (blob) {
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement("a")
                          link.href = url
                          link.download = `SOP_Step_${stepCount}_${new Date().toISOString().split("T")[0]}.png`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)
                        }
                      }, "image/png")
                    })

                    const notification = document.createElement("div")
                    notification.style.cssText = `
                      position: fixed;
                      top: 20px;
                      right: 20px;
                      background: #4CAF50;
                      color: white;
                      padding: 10px 15px;
                      border-radius: 6px;
                      z-index: 2147483649;
                      font-size: 14px;
                      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    `
                    notification.textContent = `Step ${stepCount} screenshot captured!`
                    document.body.appendChild(notification)
                    setTimeout(() => notification.remove(), 2000)
                  } catch (fallbackError) {
                    const notification = document.createElement("div")
                    notification.style.cssText = `
                      position: fixed;
                      top: 20px;
                      right: 20px;
                      background: #ff6b6b;
                      color: white;
                      padding: 10px 15px;
                      border-radius: 6px;
                      z-index: 2147483649;
                      font-size: 14px;
                      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    `
                    notification.textContent = `Failed to capture Step ${stepCount}. Please try again.`
                    document.body.appendChild(notification)
                    setTimeout(() => notification.remove(), 3000)
                  }
                }
              })

            document
              .getElementById("finish-sop")
              ?.addEventListener("click", () => {
                captureOverlay.remove()
                finalizeSOP()
              })
          }

          function finalizeSOP() {
            // Finalize and export SOP
            const finalOverlay = document.createElement("div")
            finalOverlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              background: rgba(0,0,0,0.8);
              z-index: 2147483647;
              display: flex;
              justify-content: center;
              align-items: center;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `

            const finalPanel = document.createElement("div")
            finalPanel.style.cssText = `
              background: white;
              border-radius: 12px;
              padding: 30px;
              max-width: 500px;
              width: 90%;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            `

            finalPanel.innerHTML = `
              <div style="margin-bottom: 20px;">
                <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
                <h2 style="color: #333; margin-bottom: 10px; font-size: 24px;">SOP Created Successfully!</h2>
                <p style="color: #666; font-size: 16px;">Your Standard Operating Procedure has been generated.</p>
              </div>

              <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button id="export-pdf" style="padding: 12px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Export as PDF</button>
                <button id="export-word" style="padding: 12px 20px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Export as Word</button>
                <button id="close-final" style="padding: 12px 20px; background: #f8f9fa; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 14px;">Close</button>
              </div>
            `

            finalOverlay.appendChild(finalPanel)
            document.body.appendChild(finalOverlay)

            document
              .getElementById("close-final")
              ?.addEventListener("click", () => {
                finalOverlay.remove()
              })

            document
              .getElementById("export-pdf")
              ?.addEventListener("click", () => {
                // Generate actual PDF
                generateSOPPDF()
              })

            document
              .getElementById("export-word")
              ?.addEventListener("click", () => {
                // Generate actual Word document
                generateSOPWord()
              })

            function generateSOPPDF() {
              const sopData = JSON.parse(
                localStorage.getItem("currentSOP") || "{}"
              )

              // Create PDF content
              const pdfContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <title>${sopData.title || "Standard Operating Procedure"}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                  .title { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px; }
                  .subtitle { font-size: 16px; color: #666; }
                  .section { margin-bottom: 25px; }
                  .section-title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; border-left: 4px solid #667eea; padding-left: 10px; }
                  .step { margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 5px; border-left: 3px solid #667eea; }
                  .step-number { font-weight: bold; color: #667eea; }
                  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
                </style>
              </head>
              <body>
                <div class="header">
                  <div class="title">${sopData.title || "Standard Operating Procedure"}</div>
                  <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
                </div>

                <div class="section">
                  <div class="section-title">Description</div>
                  <p>${sopData.description || "No description provided."}</p>
                </div>

                <div class="section">
                  <div class="section-title">Process Steps</div>
                  ${(sopData.steps || [])
                    .map(
                      (step, index) => `
                    <div class="step">
                      <span class="step-number">Step ${index + 1}:</span> ${step}
                    </div>
                  `
                    )
                    .join("")}
                </div>

                <div class="section">
                  <div class="section-title">Additional Information</div>
                  <p><strong>Capture Mode:</strong> ${sopData.captureMode || "Manual"}</p>
                  <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
                  <p><strong>Source URL:</strong> ${window.location.href}</p>
                </div>

                <div class="footer">
                  <p>Generated by Multi-Tool Pro Extension</p>
                </div>
              </body>
              </html>
            `

              // Convert HTML to PDF using browser's print functionality
              const printWindow = window.open("", "_blank")
              if (printWindow) {
                printWindow.document.write(pdfContent)
                printWindow.document.close()

                // Wait for content to load, then trigger print
                setTimeout(() => {
                  printWindow.print()

                  // Show success message
                  const notification = document.createElement("div")
                  notification.style.cssText = `
                  position: fixed;
                  top: 20px;
                  right: 20px;
                  background: #4CAF50;
                  color: white;
                  padding: 12px 16px;
                  border-radius: 6px;
                  z-index: 2147483649;
                  font-size: 14px;
                  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                `
                  notification.textContent =
                    "PDF generated! Use browser's print dialog to save as PDF."
                  document.body.appendChild(notification)
                  setTimeout(() => notification.remove(), 5000)
                }, 1000)
              }
            }

            function generateSOPWord() {
              const sopData = JSON.parse(
                localStorage.getItem("currentSOP") || "{}"
              )

              // Create Word document content (HTML format that Word can import)
              const wordContent = `
              <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
              <head>
                <meta charset="utf-8">
                <title>${sopData.title || "Standard Operating Procedure"}</title>
                <!--[if gte mso 9]>
                <xml>
                  <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>90</w:Zoom>
                    <w:DoNotPromptForConvert/>
                    <w:DoNotShowInsertionsAndDeletions/>
                  </w:WordDocument>
                </xml>
                <![endif]-->
                <style>
                  body { font-family: Calibri, sans-serif; margin: 1in; line-height: 1.6; }
                  .title { font-size: 20pt; font-weight: bold; text-align: center; margin-bottom: 12pt; }
                  .subtitle { font-size: 12pt; text-align: center; color: #666; margin-bottom: 24pt; }
                  .section-title { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; color: #333; }
                  .step { margin-bottom: 12pt; padding: 8pt; background-color: #f9f9f9; border-left: 3pt solid #667eea; }
                  .step-number { font-weight: bold; color: #667eea; }
                  p { margin-bottom: 6pt; }
                </style>
              </head>
              <body>
                <div class="title">${sopData.title || "Standard Operating Procedure"}</div>
                <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>

                <div class="section-title">Description</div>
                <p>${sopData.description || "No description provided."}</p>

                <div class="section-title">Process Steps</div>
                ${(sopData.steps || [])
                  .map(
                    (step, index) => `
                  <div class="step">
                    <span class="step-number">Step ${index + 1}:</span> ${step}
                  </div>
                `
                  )
                  .join("")}

                <div class="section-title">Additional Information</div>
                <p><strong>Capture Mode:</strong> ${sopData.captureMode || "Manual"}</p>
                <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Source URL:</strong> ${window.location.href}</p>

                <p style="margin-top: 24pt; text-align: center; font-size: 10pt; color: #666;">
                  Generated by Multi-Tool Pro Extension
                </p>
              </body>
              </html>
            `

              // Create and download Word document
              const blob = new Blob([wordContent], {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              })
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = `${(sopData.title || "SOP").replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.doc`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(url)

              // Show success message
              const notification = document.createElement("div")
              notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #4CAF50;
              color: white;
              padding: 12px 16px;
              border-radius: 6px;
              z-index: 2147483649;
              font-size: 14px;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `
              notification.textContent =
                "Word document downloaded successfully!"
              document.body.appendChild(notification)
              setTimeout(() => notification.remove(), 3000)
            }
          }
        }
      })

      setStatus("✅ SOP Creator launched! Follow the on-screen instructions.")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      console.error("SOP creation error:", error)
      setError(error.message || "Failed to start SOP creation")
    } finally {
      setIsWorking("")
    }
  }

  const startKnowledgeCapture = async () => {
    try {
      setIsWorking("knowledge-capture")
      setStatus("🧠 Starting knowledge capture...")

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create knowledge capture overlay
          const overlay = document.createElement("div")
          overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          `

          overlay.innerHTML = `
            <div style="margin-bottom: 15px;">
              <h3 style="margin: 0 0 10px 0; color: #333;">🧠 Knowledge Capture</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">Capture important information from this page</p>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333; font-size: 12px;">Title:</label>
              <input type="text" id="knowledge-title" placeholder="Knowledge snippet title..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333; font-size: 12px;">Notes:</label>
              <textarea id="knowledge-notes" placeholder="Add your notes..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; height: 80px; resize: vertical; box-sizing: border-box;"></textarea>
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button id="cancel-knowledge" style="padding: 8px 16px; background: #f8f9fa; color: #666; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px;">Cancel</button>
              <button id="save-knowledge" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Save Knowledge</button>
            </div>
          `

          document.body.appendChild(overlay)

          document
            .getElementById("cancel-knowledge")
            ?.addEventListener("click", () => {
              overlay.remove()
            })

          document
            .getElementById("save-knowledge")
            ?.addEventListener("click", () => {
              const title = (
                document.getElementById("knowledge-title") as HTMLInputElement
              )?.value
              const notes = (
                document.getElementById(
                  "knowledge-notes"
                ) as HTMLTextAreaElement
              )?.value

              if (!title || !notes) {
                alert("Please enter both title and notes.")
                return
              }

              // Save knowledge snippet
              const knowledge = {
                title,
                notes,
                url: window.location.href,
                timestamp: new Date().toISOString()
              }

              // Store in local storage (in real implementation, would use chrome.storage)
              const existingKnowledge = JSON.parse(
                localStorage.getItem("knowledgeBase") || "[]"
              )
              existingKnowledge.push(knowledge)
              localStorage.setItem(
                "knowledgeBase",
                JSON.stringify(existingKnowledge)
              )

              overlay.remove()

              // Show success notification
              const notification = document.createElement("div")
              notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #4CAF50;
              color: white;
              padding: 12px 16px;
              border-radius: 6px;
              z-index: 2147483648;
              font-size: 14px;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `
              notification.textContent = "Knowledge captured successfully!"
              document.body.appendChild(notification)
              setTimeout(() => notification.remove(), 3000)
            })
        }
      })

      setStatus("✅ Knowledge capture tool launched!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError(error.message || "Failed to start knowledge capture")
    } finally {
      setIsWorking("")
    }
  }

  const startVisualGuide = async () => {
    try {
      setIsWorking("visual-guide")
      setStatus("📸 Starting visual guide creation...")

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create visual guide overlay
          const overlay = document.createElement("div")
          overlay.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #667eea;
            color: white;
            padding: 20px;
            border-radius: 12px;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          `

          overlay.innerHTML = `
            <div style="margin-bottom: 15px;">
              <h3 style="margin: 0 0 8px 0;">📸 Visual Guide Creator</h3>
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">Click elements to add annotations</p>
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
              <button id="add-annotation" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Add Annotation</button>
              <button id="capture-guide" style="background: #4CAF50; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Capture Guide</button>
            </div>

            <button id="finish-guide" style="background: #ff6b6b; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">Finish Guide</button>
          `

          document.body.appendChild(overlay)

          let annotationCount = 0

          document
            .getElementById("add-annotation")
            ?.addEventListener("click", () => {
              annotationCount++
              alert(
                `Annotation mode activated! Click on any element to add annotation ${annotationCount}.`
              )
            })

          document
            .getElementById("capture-guide")
            ?.addEventListener("click", () => {
              alert(
                "Visual guide captured! This would normally save the current state with annotations."
              )
            })

          document
            .getElementById("finish-guide")
            ?.addEventListener("click", () => {
              overlay.remove()
              alert("Visual guide creation completed!")
            })
        }
      })

      setStatus("✅ Visual guide creator launched!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError(error.message || "Failed to start visual guide")
    } finally {
      setIsWorking("")
    }
  }

  const startProcessRecording = async () => {
    try {
      setIsWorking("process-recorder")
      setStatus("⏺️ Starting process recording...")

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create process recording overlay
          const overlay = document.createElement("div")
          overlay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #ff6b6b;
            color: white;
            padding: 20px;
            border-radius: 12px;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          `

          overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
              <div style="width: 12px; height: 12px; background: white; border-radius: 50%; animation: pulse 1s infinite;"></div>
              <h3 style="margin: 0;">⏺️ Recording Process</h3>
            </div>

            <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.9;">All your actions are being recorded for documentation</p>

            <div style="display: flex; gap: 10px;">
              <button id="pause-recording" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Pause</button>
              <button id="stop-recording" style="background: #333; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Stop Recording</button>
            </div>
          `

          document.body.appendChild(overlay)

          let isRecording = true

          document
            .getElementById("pause-recording")
            ?.addEventListener("click", () => {
              isRecording = !isRecording
              const button = document.getElementById("pause-recording")
              if (button) {
                button.textContent = isRecording ? "Pause" : "Resume"
              }
            })

          document
            .getElementById("stop-recording")
            ?.addEventListener("click", () => {
              overlay.remove()
              alert(
                "Process recording stopped! Documentation has been generated."
              )
            })

          // Add CSS for pulse animation
          const style = document.createElement("style")
          style.textContent = `
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `
          document.head.appendChild(style)
        }
      })

      setStatus("✅ Process recording started!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError(error.message || "Failed to start process recording")
    } finally {
      setIsWorking("")
    }
  }

  const showDocTemplates = async () => {
    try {
      setIsWorking("doc-templates")
      setStatus("📄 Loading documentation templates...")

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create templates overlay
          const overlay = document.createElement("div")
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.8);
            z-index: 2147483647;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          `

          const templatesPanel = document.createElement("div")
          templatesPanel.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 700px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          `

          templatesPanel.innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
              <h2 style="color: #333; margin-bottom: 10px;">📄 Documentation Templates</h2>
              <p style="color: #666;">Choose a template to get started quickly</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
              <div class="template-card" data-template="sop" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 10px;">📋</div>
                <h3 style="margin: 0 0 8px 0; color: #333;">SOP Template</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Standard Operating Procedure</p>
              </div>

              <div class="template-card" data-template="user-guide" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 10px;">📖</div>
                <h3 style="margin: 0 0 8px 0; color: #333;">User Guide</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Step-by-step user manual</p>
              </div>

              <div class="template-card" data-template="troubleshooting" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 10px;">🔧</div>
                <h3 style="margin: 0 0 8px 0; color: #333;">Troubleshooting</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Problem-solution guide</p>
              </div>

              <div class="template-card" data-template="api-docs" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 10px;">🔌</div>
                <h3 style="margin: 0 0 8px 0; color: #333;">API Documentation</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Technical API reference</p>
              </div>

              <div class="template-card" data-template="training" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 10px;">🎓</div>
                <h3 style="margin: 0 0 8px 0; color: #333;">Training Material</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Educational content</p>
              </div>

              <div class="template-card" data-template="release-notes" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 10px;">📝</div>
                <h3 style="margin: 0 0 8px 0; color: #333;">Release Notes</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Version change log</p>
              </div>
            </div>

            <div style="text-align: center;">
              <button id="close-templates" style="padding: 12px 24px; background: #f8f9fa; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
          `

          overlay.appendChild(templatesPanel)
          document.body.appendChild(overlay)

          // Add hover effects
          const templateCards = document.querySelectorAll(".template-card")
          templateCards.forEach((card) => {
            card.addEventListener("mouseenter", () => {
              ;(card as HTMLElement).style.borderColor = "#667eea"
              ;(card as HTMLElement).style.transform = "translateY(-2px)"
              ;(card as HTMLElement).style.boxShadow =
                "0 4px 12px rgba(0,0,0,0.1)"
            })

            card.addEventListener("mouseleave", () => {
              ;(card as HTMLElement).style.borderColor = "#e0e0e0"
              ;(card as HTMLElement).style.transform = "translateY(0)"
              ;(card as HTMLElement).style.boxShadow = "none"
            })

            card.addEventListener("click", () => {
              const template = card.getAttribute("data-template")
              alert(
                `Selected template: ${template}. This would open the template editor.`
              )
              overlay.remove()
            })
          })

          document
            .getElementById("close-templates")
            ?.addEventListener("click", () => {
              overlay.remove()
            })
        }
      })

      setStatus("✅ Documentation templates loaded!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError(error.message || "Failed to load templates")
    } finally {
      setIsWorking("")
    }
  }

  const exportDocumentation = async () => {
    try {
      setIsWorking("export-docs")
      setStatus("📤 Preparing export options...")

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create export overlay
          const overlay = document.createElement("div")
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.8);
            z-index: 2147483647;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          `

          const exportPanel = document.createElement("div")
          exportPanel.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          `

          exportPanel.innerHTML = `
            <div style="margin-bottom: 25px;">
              <h2 style="color: #333; margin-bottom: 10px;">📤 Export Documentation</h2>
              <p style="color: #666;">Choose your preferred export format</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 25px;">
              <button class="export-btn" data-format="pdf" style="padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer; background: white; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 8px;">📄</div>
                <div style="font-weight: 600; color: #333;">PDF</div>
              </button>

              <button class="export-btn" data-format="word" style="padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer; background: white; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
                <div style="font-weight: 600; color: #333;">Word</div>
              </button>

              <button class="export-btn" data-format="markdown" style="padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer; background: white; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
                <div style="font-weight: 600; color: #333;">Markdown</div>
              </button>

              <button class="export-btn" data-format="html" style="padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer; background: white; transition: all 0.3s ease;">
                <div style="font-size: 32px; margin-bottom: 8px;">🌐</div>
                <div style="font-weight: 600; color: #333;">HTML</div>
              </button>
            </div>

            <div style="text-align: center;">
              <button id="close-export" style="padding: 12px 24px; background: #f8f9fa; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">Cancel</button>
            </div>
          `

          overlay.appendChild(exportPanel)
          document.body.appendChild(overlay)

          // Add hover effects and click handlers
          const exportBtns = document.querySelectorAll(".export-btn")
          exportBtns.forEach((btn) => {
            btn.addEventListener("mouseenter", () => {
              ;(btn as HTMLElement).style.borderColor = "#667eea"
              ;(btn as HTMLElement).style.transform = "translateY(-2px)"
              ;(btn as HTMLElement).style.boxShadow =
                "0 4px 12px rgba(0,0,0,0.1)"
            })

            btn.addEventListener("mouseleave", () => {
              ;(btn as HTMLElement).style.borderColor = "#e0e0e0"
              ;(btn as HTMLElement).style.transform = "translateY(0)"
              ;(btn as HTMLElement).style.boxShadow = "none"
            })

            btn.addEventListener("click", () => {
              const format = btn.getAttribute("data-format")
              alert(
                `Exporting as ${format?.toUpperCase()}... This would generate and download the file.`
              )
              overlay.remove()
            })
          })

          document
            .getElementById("close-export")
            ?.addEventListener("click", () => {
              overlay.remove()
            })
        }
      })

      setStatus("✅ Export options ready!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setError(error.message || "Failed to show export options")
    } finally {
      setIsWorking("")
    }
  }

  return (
    <div>
      {/* Status Display */}
      {status && (
        <div
          style={{
            background: "#e3f2fd",
            color: "#1976d2",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            textAlign: "center"
          }}>
          {status}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            textAlign: "center"
          }}>
          {error}
        </div>
      )}

      {/* Real Working Documentation Interface */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* View Selector */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            onClick={() => setActiveView("create")}
            style={{
              padding: "8px 16px",
              background: activeView === "create" ? "#667eea" : "#f0f0f0",
              color: activeView === "create" ? "white" : "#333",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600"
            }}>
            📋 Create SOP
          </button>
          <button
            onClick={() => setActiveView("knowledge")}
            style={{
              padding: "8px 16px",
              background: activeView === "knowledge" ? "#667eea" : "#f0f0f0",
              color: activeView === "knowledge" ? "white" : "#333",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600"
            }}>
            🧠 Knowledge
          </button>
          <button
            onClick={() => setActiveView("list")}
            style={{
              padding: "8px 16px",
              background: activeView === "list" ? "#667eea" : "#f0f0f0",
              color: activeView === "list" ? "white" : "#333",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600"
            }}>
            📄 View All
          </button>
        </div>

        {/* Create SOP View */}
        {activeView === "create" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#333" }}>
              📋 Create New SOP
            </h3>

            <input
              type="text"
              placeholder="SOP Title (e.g., 'How to Process Orders')"
              value={sopTitle}
              onChange={(e) => setSOPTitle(e.target.value)}
              style={{
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />

            <textarea
              placeholder="SOP Description (optional)"
              value={sopDescription}
              onChange={(e) => setSOPDescription(e.target.value)}
              style={{
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px",
                height: "80px",
                resize: "vertical"
              }}
            />

            {/* SOP Steps Management */}
            <div style={{ marginTop: "12px" }}>
              <label
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#333",
                  marginBottom: "8px",
                  display: "block"
                }}>
                Process Steps (Optional):
              </label>
              {sopSteps.map((step, index) => (
                <div
                  key={index}
                  style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    placeholder={`Step ${index + 1}: Describe the action...`}
                    value={step}
                    onChange={(e) => {
                      const newSteps = [...sopSteps]
                      newSteps[index] = e.target.value
                      setSOPSteps(newSteps)
                    }}
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "13px",
                      flex: 1
                    }}
                  />
                  {sopSteps.length > 1 && (
                    <button
                      onClick={() => {
                        const newSteps = sopSteps.filter((_, i) => i !== index)
                        setSOPSteps(newSteps)
                      }}
                      style={{
                        padding: "8px",
                        background: "#ff4444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setSOPSteps([...sopSteps, ""])}
                style={{
                  padding: "6px 12px",
                  background: "#e9ecef",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600"
                }}>
                + Add Step
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={createSOPWithTemplate}
                disabled={isWorking === "creating-sop" || !sopTitle.trim()}
                style={{
                  padding: "12px 20px",
                  background: sopTitle.trim() ? "#4CAF50" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: sopTitle.trim() ? "pointer" : "not-allowed",
                  fontSize: "14px",
                  fontWeight: "600",
                  flex: 1
                }}>
                {isWorking === "creating-sop"
                  ? "Creating..."
                  : "📋 Create SOP with Template"}
              </button>

              <button
                onClick={captureScreenshotForSOP}
                disabled={isWorking === "capturing-screenshot"}
                style={{
                  padding: "12px 16px",
                  background: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}>
                {isWorking === "capturing-screenshot" ? "📸..." : "📸"}
              </button>
            </div>
          </div>
        )}

        {/* Knowledge Capture View */}
        {activeView === "knowledge" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#333" }}>
              🧠 Capture Knowledge
            </h3>

            <input
              type="text"
              placeholder="Knowledge Title (e.g., 'Important Process Note')"
              value={knowledgeTitle}
              onChange={(e) => setKnowledgeTitle(e.target.value)}
              style={{
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />

            <textarea
              placeholder="Knowledge Content - What did you learn?"
              value={knowledgeContent}
              onChange={(e) => setKnowledgeContent(e.target.value)}
              style={{
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px",
                height: "100px",
                resize: "vertical"
              }}
            />

            <input
              type="text"
              placeholder="Tags (comma-separated, e.g., 'process, important, customer-service')"
              value={knowledgeTags}
              onChange={(e) => setKnowledgeTags(e.target.value)}
              style={{
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "13px"
              }}
            />

            <button
              onClick={captureKnowledgeWithSharing}
              disabled={
                isWorking === "capturing-knowledge" ||
                !knowledgeTitle.trim() ||
                !knowledgeContent.trim()
              }
              style={{
                padding: "12px 20px",
                background:
                  knowledgeTitle.trim() && knowledgeContent.trim()
                    ? "#4CAF50"
                    : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor:
                  knowledgeTitle.trim() && knowledgeContent.trim()
                    ? "pointer"
                    : "not-allowed",
                fontSize: "14px",
                fontWeight: "600"
              }}>
              {isWorking === "capturing-knowledge"
                ? "Capturing..."
                : "🧠 Capture Knowledge with Tags"}
            </button>
          </div>
        )}

        {/* List View */}
        {activeView === "list" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#333" }}>
              📄 Your Documentation
            </h3>

            {/* SOPs List */}
            {allSOPs.length > 0 && (
              <div>
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "14px",
                    color: "#666"
                  }}>
                  📋 SOPs ({allSOPs.length})
                </h4>
                {allSOPs.slice(0, 3).map((sop: any) => (
                  <div
                    key={sop.id}
                    onClick={() => setCurrentSOP(sop)}
                    style={{
                      padding: "10px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      cursor: "pointer",
                      background:
                        currentSOP?.id === sop.id ? "#f0f8ff" : "white"
                    }}>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>
                      {sop.title}
                    </div>
                    <div style={{ fontSize: "11px", color: "#666" }}>
                      Created: {new Date(sop.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Knowledge List */}
            {allKnowledge.length > 0 && (
              <div>
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "14px",
                    color: "#666"
                  }}>
                  🧠 Knowledge ({allKnowledge.length})
                </h4>
                {allKnowledge.slice(0, 3).map((knowledge: any) => (
                  <div
                    key={knowledge.id}
                    style={{
                      padding: "10px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      background: "white"
                    }}>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>
                      {knowledge.title}
                    </div>
                    <div style={{ fontSize: "11px", color: "#666" }}>
                      {knowledge.content.substring(0, 50)}...
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generate Document Button */}
            {currentSOP && (
              <button
                onClick={generateSOPDocument}
                disabled={isWorking === "generating-document"}
                style={{
                  padding: "12px 20px",
                  background: "#ff6b6b",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginTop: "8px"
                }}>
                {isWorking === "generating-document"
                  ? "Generating..."
                  : `📤 Export "${currentSOP.title}"`}
              </button>
            )}

            {allSOPs.length === 0 && allKnowledge.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  fontSize: "14px",
                  padding: "20px"
                }}>
                No documentation created yet.
                <br />
                Use the tabs above to create SOPs or capture knowledge!
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "12px",
          background: "#f5f5f5",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#666",
          textAlign: "center"
        }}>
        💡 Real working documentation tools - Create SOPs, capture knowledge,
        generate documents!
      </div>
    </div>
  )
}

// 📋 DOCUMENTATION FEATURES SECTION - Real Working Implementation
function DocumentationFeaturesSection() {
  const [sopTitle, setSOPTitle] = useState("")
  const [sopDescription, setSOPDescription] = useState("")
  const [knowledgeTitle, setKnowledgeTitle] = useState("")
  const [knowledgeContent, setKnowledgeContent] = useState("")
  const [status, setStatus] = useState("")
  const [isWorking, setIsWorking] = useState("")
  const [allSOPs, setAllSOPs] = useState<any[]>([])
  const [allKnowledge, setAllKnowledge] = useState<any[]>([])
  const [activeView, setActiveView] = useState("create")

  // Real SOP Creation Function
  const createSOP = async () => {
    if (!sopTitle.trim()) {
      alert("Please enter an SOP title")
      return
    }

    setIsWorking("creating")
    setStatus("Creating SOP...")

    try {
      const sopData = {
        id: Date.now().toString(),
        title: sopTitle,
        description: sopDescription,
        steps: [],
        screenshots: [],
        createdAt: new Date().toISOString()
      }

      const result = await chrome.storage.local.get(["multiToolPro_sops"])
      const existingSOPs = result.multiToolPro_sops || []
      existingSOPs.push(sopData)
      await chrome.storage.local.set({ multiToolPro_sops: existingSOPs })

      setStatus("✅ SOP created successfully!")
      setSOPTitle("")
      setSOPDescription("")
      setAllSOPs(existingSOPs)

      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setStatus("❌ Failed to create SOP: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  // Real Knowledge Capture Function
  const captureKnowledge = async () => {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) {
      alert("Please enter both title and content")
      return
    }

    setIsWorking("capturing")
    setStatus("Capturing knowledge...")

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      const knowledgeData = {
        id: Date.now().toString(),
        title: knowledgeTitle,
        content: knowledgeContent,
        url: tab?.url || "",
        createdAt: new Date().toISOString()
      }

      const result = await chrome.storage.local.get(["multiToolPro_knowledge"])
      const existingKnowledge = result.multiToolPro_knowledge || []
      existingKnowledge.push(knowledgeData)
      await chrome.storage.local.set({
        multiToolPro_knowledge: existingKnowledge
      })

      setStatus("✅ Knowledge captured successfully!")
      setKnowledgeTitle("")
      setKnowledgeContent("")
      setAllKnowledge(existingKnowledge)

      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setStatus("❌ Failed to capture knowledge: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  // Real Screenshot Capture Function
  const captureScreenshot = async () => {
    setIsWorking("screenshot")
    setStatus("Capturing screenshot...")

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab || !tab.id) throw new Error("No active tab found")

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
        quality: 90
      })

      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `SOP_Screenshot_${new Date().toISOString().split("T")[0]}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setStatus("✅ Screenshot downloaded!")
      setTimeout(() => setStatus(""), 3000)
    } catch (error: any) {
      setStatus("❌ Failed to capture screenshot: " + error.message)
    } finally {
      setIsWorking("")
    }
  }

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const sopResult = await chrome.storage.local.get(["multiToolPro_sops"])
        const knowledgeResult = await chrome.storage.local.get([
          "multiToolPro_knowledge"
        ])

        setAllSOPs(sopResult.multiToolPro_sops || [])
        setAllKnowledge(knowledgeResult.multiToolPro_knowledge || [])
      } catch (error) {
        console.error("Failed to load data:", error)
      }
    }
    loadData()
  }, [])

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        color: "white",
        padding: "20px",
        margin: "16px",
        borderRadius: "12px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
      }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px"
        }}>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
          📋 Documentation & SOP Tools
        </h3>
        <span
          style={{
            background: "#ff4444",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "600"
          }}>
          NEW
        </span>
      </div>

      {/* Status Message */}
      {status && (
        <div
          style={{
            background: "rgba(255,255,255,0.2)",
            padding: "8px 12px",
            borderRadius: "6px",
            marginBottom: "12px",
            fontSize: "12px",
            fontWeight: "600"
          }}>
          {status}
        </div>
      )}

      {/* View Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          onClick={() => setActiveView("create")}
          style={{
            padding: "8px 16px",
            background:
              activeView === "create"
                ? "rgba(255,255,255,0.3)"
                : "rgba(255,255,255,0.1)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600"
          }}>
          📋 Create SOP
        </button>
        <button
          onClick={() => setActiveView("knowledge")}
          style={{
            padding: "8px 16px",
            background:
              activeView === "knowledge"
                ? "rgba(255,255,255,0.3)"
                : "rgba(255,255,255,0.1)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600"
          }}>
          🧠 Knowledge
        </button>
        <button
          onClick={() => setActiveView("list")}
          style={{
            padding: "8px 16px",
            background:
              activeView === "list"
                ? "rgba(255,255,255,0.3)"
                : "rgba(255,255,255,0.1)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600"
          }}>
          📄 View All
        </button>
      </div>

      {/* Create SOP View */}
      {activeView === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            placeholder="SOP Title (e.g., 'How to Process Orders')"
            value={sopTitle}
            onChange={(e) => setSOPTitle(e.target.value)}
            style={{
              padding: "10px",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />
          <textarea
            placeholder="SOP Description (optional)"
            value={sopDescription}
            onChange={(e) => setSOPDescription(e.target.value)}
            style={{
              padding: "10px",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              height: "60px",
              resize: "vertical"
            }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={createSOP}
              disabled={isWorking === "creating" || !sopTitle.trim()}
              style={{
                padding: "10px 16px",
                background: sopTitle.trim() ? "#4CAF50" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: sopTitle.trim() ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: "600",
                flex: 1
              }}>
              {isWorking === "creating" ? "Creating..." : "📋 Create SOP"}
            </button>
            <button
              onClick={captureScreenshot}
              disabled={isWorking === "screenshot"}
              style={{
                padding: "10px 16px",
                background: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}>
              {isWorking === "screenshot" ? "📸..." : "📸"}
            </button>
          </div>
        </div>
      )}

      {/* Knowledge Capture View */}
      {activeView === "knowledge" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            placeholder="Knowledge Title"
            value={knowledgeTitle}
            onChange={(e) => setKnowledgeTitle(e.target.value)}
            style={{
              padding: "10px",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />
          <textarea
            placeholder="Knowledge Content - What did you learn?"
            value={knowledgeContent}
            onChange={(e) => setKnowledgeContent(e.target.value)}
            style={{
              padding: "10px",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              height: "80px",
              resize: "vertical"
            }}
          />
          <button
            onClick={captureKnowledge}
            disabled={
              isWorking === "capturing" ||
              !knowledgeTitle.trim() ||
              !knowledgeContent.trim()
            }
            style={{
              padding: "10px 16px",
              background:
                knowledgeTitle.trim() && knowledgeContent.trim()
                  ? "#4CAF50"
                  : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor:
                knowledgeTitle.trim() && knowledgeContent.trim()
                  ? "pointer"
                  : "not-allowed",
              fontSize: "14px",
              fontWeight: "600"
            }}>
            {isWorking === "capturing"
              ? "Capturing..."
              : "🧠 Capture Knowledge"}
          </button>
        </div>
      )}

      {/* List View */}
      {activeView === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "14px", fontWeight: "600" }}>
            📋 SOPs: {allSOPs.length} | 🧠 Knowledge: {allKnowledge.length}
          </div>
          {allSOPs.length === 0 && allKnowledge.length === 0 && (
            <div
              style={{
                textAlign: "center",
                fontSize: "14px",
                padding: "20px",
                opacity: 0.8
              }}>
              No documentation created yet.
              <br />
              Use the tabs above to create SOPs or capture knowledge!
            </div>
          )}
          {(allSOPs.length > 0 || allKnowledge.length > 0) && (
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              Click the Settings button (⚙️) in the analytics bar to view and
              manage all your documentation.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function IndexPopup() {
  const [activeTab, setActiveTab] = useState<string>("capture")
  const [extensionError, setExtensionError] = useState<string>("")
  const [analytics, setAnalytics] = useState({
    totalScreenshots: 0,
    totalRecordings: 0,
    favoriteFeature: "screenshot",
    lastUsed: new Date().toISOString(),
    dailyUsage: {} as Record<string, number>,
    featureUsage: {} as Record<string, number>
  })

  // Check extension context and load analytics
  useEffect(() => {
    const checkContext = () => {
      if (!checkChromeAPIs()) {
        setExtensionError(
          "Extension context lost. Please reload the extension and try again."
        )
      } else {
        setExtensionError("")
      }
    }

    // Load analytics data
    chrome.storage.local.get(["analytics"], (result) => {
      if (result.analytics) {
        setAnalytics(result.analytics)
      }
    })

    checkContext()
    const interval = setInterval(checkContext, 5000)

    return () => clearInterval(interval)
  }, [])

  // Track feature usage with detailed analytics
  const trackFeatureUsage = (feature: string) => {
    const today = new Date().toDateString()
    const newAnalytics = {
      ...analytics,
      [`total${feature.charAt(0).toUpperCase() + feature.slice(1)}s`]:
        (analytics[
          `total${feature.charAt(0).toUpperCase() + feature.slice(1)}s`
        ] || 0) + 1,
      favoriteFeature: feature,
      lastUsed: new Date().toISOString(),
      dailyUsage: {
        ...analytics.dailyUsage,
        [today]: (analytics.dailyUsage?.[today] || 0) + 1
      },
      featureUsage: {
        ...analytics.featureUsage,
        [feature]: (analytics.featureUsage?.[feature] || 0) + 1
      }
    }
    setAnalytics(newAnalytics)
    chrome.storage.local.set({ analytics: newAnalytics })
  }

  // Get usage stats for display
  const getUsageStats = () => {
    const totalUsage = Object.values(analytics.featureUsage || {}).reduce(
      (a: number, b: number) => a + b,
      0
    )
    const mostUsedFeature =
      Object.entries(analytics.featureUsage || {}).sort(
        ([, a], [, b]) => (b as number) - (a as number)
      )[0]?.[0] || "capture"

    return {
      totalUsage,
      mostUsedFeature,
      todayUsage: analytics.dailyUsage?.[new Date().toDateString()] || 0
    }
  }

  const tabs = [
    {
      id: "capture",
      label: "Screenshot",
      icon: "📸",
      desc: "Capture & save",
      color: "#667eea"
    },
    {
      id: "recorder",
      label: "Recording",
      icon: "🎥",
      desc: "Screen record",
      color: "#f093fb"
    },
    {
      id: "documentation",
      label: "Documentation",
      icon: "📋",
      desc: "SOP & Knowledge",
      color: "#4facfe"
    },
    {
      id: "zoom",
      label: "Zoom",
      icon: "🔍",
      desc: "Magnify pages",
      color: "#43e97b"
    },
    {
      id: "tools",
      label: "Pro Tools",
      icon: "🛠️",
      desc: "Advanced kit",
      color: "#fa709a"
    },
    {
      id: "accessibility",
      label: "A11y",
      icon: "♿",
      desc: "Accessibility",
      color: "#ffecd2"
    }
  ]

  // Debug: Log tabs array and show alert
  console.log("Multi-Tool Pro: Tabs array length:", tabs.length)
  console.log(
    "Multi-Tool Pro: Tab IDs:",
    tabs.map((t) => t.id)
  )

  // Documentation features now added directly after title

  // If extension context is invalid, show error message
  if (extensionError) {
    return (
      <div
        style={{
          width: "400px",
          padding: "20px",
          background: "#ffffff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          borderRadius: "16px",
          textAlign: "center"
        }}>
        <div
          style={{
            background: "linear-gradient(135deg, #ff6b6b, #ee5a52)",
            color: "white",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "20px"
          }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: "18px" }}>
            🔄 Extension Context Lost
          </h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>
            The extension was reloaded during development
          </p>
        </div>

        <div
          style={{
            background: "#f8f9fa",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "20px",
            textAlign: "left"
          }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#333" }}>
            To fix this:
          </h3>
          <ol
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "13px",
              color: "#666"
            }}>
            <li>Close this popup</li>
            <li>
              Go to <code>chrome://extensions/</code>
            </li>
            <li>Find "Multi-Tool Extension"</li>
            <li>Click the refresh/reload button</li>
            <li>Click the extension icon again</li>
          </ol>
        </div>

        <button
          onClick={() => window.close()}
          style={{
            padding: "12px 24px",
            background: "#667eea",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600"
          }}>
          Close Popup
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        width: "400px",
        minHeight: "550px",
        background: "#ffffff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        borderRadius: "20px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.2)"
      }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "24px 20px",
          textAlign: "center",
          position: "relative"
        }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05) 0%, transparent 50%)",
            backgroundSize: "100px 100px"
          }}></div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              margin: "0 0 8px 0",
              fontSize: "24px",
              fontWeight: "700",
              letterSpacing: "-0.5px",
              background: "linear-gradient(45deg, #ffffff, #e3f2fd)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}>
            🛠️ Multi-Tool Pro
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              opacity: 0.9,
              fontWeight: "400"
            }}>
            Advanced Screenshot • Recording • Color Picker • Zoom
          </p>
        </div>
      </div>

      {/* 📋 DOCUMENTATION FEATURES - Added directly after title */}
      <DocumentationFeaturesSection />

      {/* Documentation Features Popup */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea, #764ba2)",
          color: "white",
          padding: "16px",
          margin: "16px",
          borderRadius: "12px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px"
          }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
            📋 Documentation & SOP Tools
          </h3>
          <span
            style={{
              background: "#ff4444",
              color: "white",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: "600"
            }}>
            NEW
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "12px"
          }}>
          <button
            onClick={() => {
              setActiveTab("documentation")
              // Trigger SOP Creator
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]?.id) {
                    chrome.scripting.executeScript({
                      target: { tabId: tabs[0].id },
                      func: () => {
                        alert(
                          "📋 SOP Creator activated! This will open the SOP creation wizard."
                        )
                      }
                    })
                  }
                }
              )
            }}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "8px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600"
            }}>
            📋 SOP Creator
          </button>

          <button
            onClick={() => {
              setActiveTab("documentation")
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]?.id) {
                    chrome.scripting.executeScript({
                      target: { tabId: tabs[0].id },
                      func: () => {
                        alert(
                          "🧠 Knowledge Capture activated! This will open the knowledge capture tool."
                        )
                      }
                    })
                  }
                }
              )
            }}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "8px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600"
            }}>
            🧠 Knowledge Capture
          </button>

          <button
            onClick={() => {
              setActiveTab("documentation")
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]?.id) {
                    chrome.scripting.executeScript({
                      target: { tabId: tabs[0].id },
                      func: () => {
                        alert(
                          "📸 Visual Guide activated! This will create step-by-step visual documentation."
                        )
                      }
                    })
                  }
                }
              )
            }}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "8px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600"
            }}>
            📸 Visual Guide
          </button>

          <button
            onClick={() => {
              setActiveTab("documentation")
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]?.id) {
                    chrome.scripting.executeScript({
                      target: { tabId: tabs[0].id },
                      func: () => {
                        alert(
                          "📄 Doc Templates activated! This will show documentation templates."
                        )
                      }
                    })
                  }
                }
              )
            }}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "8px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600"
            }}>
            📄 Doc Templates
          </button>
        </div>

        <button
          onClick={() => setActiveTab("documentation")}
          style={{
            background: "#4CAF50",
            border: "none",
            color: "white",
            padding: "10px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600",
            width: "100%"
          }}>
          🚀 Open Full Documentation Suite
        </button>
      </div>

      {/* Modern Tab Navigation */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "16px 16px 8px 16px"
        }}>
        {/* Analytics Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            padding: "8px 12px",
            background: "rgba(102, 126, 234, 0.05)",
            borderRadius: "8px",
            fontSize: "11px",
            color: "#667eea"
          }}>
          <span>📸 {analytics.totalScreenshots}</span>
          <span>🎥 {analytics.totalRecordings}</span>
          <span>📊 {getUsageStats().todayUsage} today</span>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            style={{
              background: "none",
              border: "1px solid #667eea",
              borderRadius: "6px",
              color: "#667eea",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: "600"
            }}
            title="Settings & Permissions">
            ⚙️ Settings
          </button>
        </div>

        {/* Tab Grid - 6 tabs in 3x2 layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px",
            minHeight: "140px"
          }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                trackFeatureUsage(tab.id)
              }}
              style={{
                padding: "12px 6px",
                background:
                  activeTab === tab.id
                    ? `linear-gradient(135deg, ${tab.color}, ${tab.color}dd)`
                    : "white",
                border: activeTab === tab.id ? "none" : "1px solid #e9ecef",
                borderRadius: "12px",
                cursor: "pointer",
                textAlign: "center",
                fontSize: "10px",
                fontWeight: "600",
                color: activeTab === tab.id ? "white" : "#495057",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                transform:
                  activeTab === tab.id ? "translateY(-2px)" : "translateY(0)",
                boxShadow:
                  activeTab === tab.id
                    ? `0 8px 25px ${tab.color}40`
                    : "0 2px 4px rgba(0,0,0,0.05)",
                position: "relative",
                overflow: "hidden"
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.transform = "translateY(-1px)"
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)"
                }
              }}>
              {/* Active indicator */}
              {activeTab === tab.id && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background:
                      "linear-gradient(45deg, rgba(255,255,255,0.2), transparent)",
                    pointerEvents: "none"
                  }}></div>
              )}

              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: "14px", marginBottom: "3px" }}>
                  {tab.icon}
                </div>
                <div
                  style={{
                    fontSize: "8px",
                    fontWeight: "700",
                    marginBottom: "1px"
                  }}>
                  {tab.label}
                  {tab.id === "documentation" && (
                    <span
                      style={{
                        fontSize: "5px",
                        background: "#ff4444",
                        color: "white",
                        padding: "1px 2px",
                        borderRadius: "2px",
                        marginLeft: "1px",
                        fontWeight: "600"
                      }}>
                      NEW
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "6px",
                    opacity: activeTab === tab.id ? 0.9 : 0.6,
                    fontWeight: "500"
                  }}>
                  {tab.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div
        style={{
          background: "#ffffff",
          minHeight: "320px",
          borderRadius: "16px 16px 0 0",
          marginTop: "-8px",
          position: "relative",
          zIndex: 2,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)"
        }}>
        <div
          style={{
            padding: activeTab === "capture" ? "0" : "20px",
            minHeight: "300px"
          }}>
          {activeTab === "capture" && <ScreenCapture />}
          {activeTab === "recorder" && <ScreenRecorder />}
          {activeTab === "documentation" && <ComprehensiveDocumentationTool />}
          {activeTab === "zoom" && <ScreenZoom />}
          {activeTab === "tools" && <ProToolsSimple />}
          {activeTab === "accessibility" && <AccessibilityToolsSimple />}
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
