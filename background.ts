import type { ExtensionMessage } from "~types"

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Multi-Tool Extension installed")
})

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case "CAPTURE_SCREENSHOT":
        handleScreenshot(message.payload, sendResponse)
        return true // Keep message channel open for async response

      case "START_RECORDING":
        handleStartRecording(sendResponse)
        return true

      case "STOP_RECORDING":
        handleStopRecording(sendResponse)
        return true

      case "TOGGLE_COLOR_PICKER":
        handleToggleColorPicker(sender.tab?.id, message.payload, sendResponse)
        return true

      case "SET_ZOOM":
        handleSetZoom(sender.tab?.id, message.payload, sendResponse)
        return true

      case "RESET_ZOOM":
        handleResetZoom(sender.tab?.id, sendResponse)
        return true

      default:
        console.warn("Unknown message type:", message.type)
    }
  }
)

async function handleScreenshot(
  options: any,
  sendResponse: (response: any) => void
) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) {
      throw new Error("No active tab found")
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tabs[0].windowId, {
      format: options?.format || "png",
      quality: options?.quality || 100
    })

    sendResponse({ success: true, dataUrl })
  } catch (error) {
    console.error("Screenshot error:", error)
    sendResponse({ success: false, error: error.message })
  }
}

async function handleStartRecording(sendResponse: (response: any) => void) {
  try {
    // Get the current tab to pass to chooseDesktopMedia
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const currentTab = tabs[0]

    if (!currentTab) {
      sendResponse({ success: false, error: "No active tab found" })
      return
    }

    // Request screen capture permission
    chrome.desktopCapture.chooseDesktopMedia(
      ["screen", "window", "tab"],
      currentTab,
      (streamId) => {
        if (streamId) {
          sendResponse({ success: true, streamId })
        } else {
          sendResponse({
            success: false,
            error: "User cancelled screen sharing"
          })
        }
      }
    )
  } catch (error) {
    console.error("Recording start error:", error)
    sendResponse({ success: false, error: error.message })
  }
}

function handleStopRecording(sendResponse: (response: any) => void) {
  // Recording stop is handled in the popup/content script
  sendResponse({ success: true })
}

async function handleToggleColorPicker(
  tabId: number | undefined,
  enabled: boolean,
  sendResponse: (response: any) => void
) {
  if (!tabId) {
    sendResponse({ success: false, error: "No tab ID provided" })
    return
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (enabled) => {
        // This function runs in the content script context
        window.postMessage(
          {
            type: "TOGGLE_COLOR_PICKER",
            enabled
          },
          "*"
        )
      },
      args: [enabled]
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Color picker toggle error:", error)
    sendResponse({ success: false, error: error.message })
  }
}

async function handleSetZoom(
  tabId: number | undefined,
  zoomLevel: number,
  sendResponse: (response: any) => void
) {
  if (!tabId) {
    sendResponse({ success: false, error: "No tab ID provided" })
    return
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (zoomLevel) => {
        document.body.style.transform = `scale(${zoomLevel / 100})`
        document.body.style.transformOrigin = "top left"
        document.body.style.width = `${100 / (zoomLevel / 100)}%`
        document.body.style.height = `${100 / (zoomLevel / 100)}%`
      },
      args: [zoomLevel]
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Zoom set error:", error)
    sendResponse({ success: false, error: error.message })
  }
}

async function handleResetZoom(
  tabId: number | undefined,
  sendResponse: (response: any) => void
) {
  if (!tabId) {
    sendResponse({ success: false, error: "No tab ID provided" })
    return
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.body.style.transform = ""
        document.body.style.transformOrigin = ""
        document.body.style.width = ""
        document.body.style.height = ""
      }
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Zoom reset error:", error)
    sendResponse({ success: false, error: error.message })
  }
}
