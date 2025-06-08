import { useEffect, useState } from "react"

// Performance optimizations
let isInitialized = false
let analyticsCache: any = null
let settingsCache: any = null

// Debounce function for performance
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

function IndexOptions() {
  const [activeTab, setActiveTab] = useState("permissions")
  const [settings, setSettings] = useState<any>({})
  const [analytics, setAnalytics] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)

  // Debounced save function
  const debouncedSaveSettings = debounce(saveSettings, 500)

  useEffect(() => {
    initializeOptionsPage()
  }, [])

  const initializeOptionsPage = async () => {
    if (isInitialized) return
    isInitialized = true

    try {
      await loadSettings()
      if (activeTab === "analytics") {
        await loadAnalytics()
      }
    } catch (error) {
      console.error("Failed to initialize options page:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSettings = async () => {
    if (settingsCache) {
      setSettings(settingsCache)
      return
    }

    return new Promise((resolve) => {
      chrome.storage.sync.get("multiToolSettings", (data) => {
        const loadedSettings = data.multiToolSettings || {
          defaultFormat: "png",
          jpegQuality: 90,
          autoDownload: false,
          includeTimestamp: true,
          videoQuality: "720p",
          frameRate: 30,
          includeAudio: false,
          theme: "light",
          showTooltips: true,
          compactMode: false,
          saveColorHistory: true,
          disableAutoReload: true
        }
        settingsCache = loadedSettings
        setSettings(loadedSettings)
        resolve(loadedSettings)
      })
    })
  }

  function saveSettings() {
    settingsCache = settings
    chrome.storage.sync.set({ multiToolSettings: settings }, () => {
      showNotification("Settings saved successfully!", "success")
    })
  }

  const loadAnalytics = async () => {
    if (analyticsCache) {
      setAnalytics(analyticsCache)
      return
    }

    return new Promise((resolve) => {
      chrome.storage.local.get(["analytics"], (result) => {
        const loadedAnalytics = result.analytics || {
          totalScreenshots: 0,
          totalRecordings: 0,
          featureUsage: {},
          dailyUsage: {}
        }
        analyticsCache = loadedAnalytics
        setAnalytics(loadedAnalytics)
        resolve(loadedAnalytics)
      })
    })
  }

  const handleTabChange = async (tabId: string) => {
    setActiveTab(tabId)

    // Lazy load tab content
    if (tabId === "analytics" && !analyticsCache) {
      await loadAnalytics()
    }
  }

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    debouncedSaveSettings()
  }

  const showNotification = (message: string, type: string = "info") => {
    // Simple notification - in a real implementation, you'd use a toast library
    console.log(`${type.toUpperCase()}: ${message}`)
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}>
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
        padding: "20px"
      }}>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          background: "white",
          borderRadius: "20px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
          overflow: "hidden"
        }}>
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "40px",
            textAlign: "center"
          }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "700",
              marginBottom: "10px"
            }}>
            🛠️ Multi-Tool Pro Settings
          </h1>
          <p style={{ fontSize: "16px", opacity: 0.9 }}>
            Configure your extension settings, manage permissions, and customize
            your experience
          </p>
        </div>

        {/* Main Content */}
        <div style={{ padding: "40px" }}>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid #f0f0f0",
              marginBottom: "40px",
              gap: "0"
            }}>
            {[
              { id: "permissions", label: "🔐 Permissions" },
              { id: "settings", label: "⚙️ Settings" },
              { id: "documentation", label: "📋 Documentation" },
              { id: "analytics", label: "📊 Analytics" },
              { id: "features", label: "🛠️ Features" },
              { id: "about", label: "ℹ️ About" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  padding: "15px 30px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: activeTab === tab.id ? "#667eea" : "#666",
                  borderBottom:
                    activeTab === tab.id
                      ? "3px solid #667eea"
                      : "3px solid transparent",
                  backgroundColor:
                    activeTab === tab.id
                      ? "rgba(102, 126, 234, 0.05)"
                      : "transparent",
                  transition: "all 0.3s ease"
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "permissions" && (
            <div>
              <div
                style={{
                  background: "#e3f2fd",
                  borderLeft: "4px solid #2196f3",
                  color: "#1976d2",
                  padding: "15px",
                  borderRadius: "8px",
                  marginBottom: "20px"
                }}>
                <strong>🔒 Privacy First:</strong> This extension only requests
                permissions it needs to function. All data stays on your device
                - nothing is sent to external servers.
              </div>

              <div
                style={{
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "1px solid #e9ecef"
                }}>
                <h2
                  style={{
                    fontSize: "20px",
                    color: "#333",
                    marginBottom: "15px"
                  }}>
                  🖥️ Required Permissions
                </h2>
                <p
                  style={{
                    color: "#666",
                    lineHeight: 1.6,
                    marginBottom: "20px"
                  }}>
                  These permissions are essential for the extension to work
                  properly:
                </p>

                {[
                  {
                    title: "Active Tab Access",
                    desc: "Required to capture screenshots and interact with the current webpage",
                    status: "granted"
                  },
                  {
                    title: "Script Injection",
                    desc: "Needed for annotation tools, rulers, and CSS injection features",
                    status: "granted"
                  },
                  {
                    title: "Downloads",
                    desc: "Allows saving screenshots, recordings, and other files to your computer",
                    status: "granted"
                  }
                ].map((permission, index) => (
                  <div
                    key={index}
                    style={{
                      background: "white",
                      borderRadius: "8px",
                      padding: "20px",
                      marginBottom: "15px",
                      border: "1px solid #e0e0e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                    <div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#333",
                          marginBottom: "5px"
                        }}>
                        {permission.title}
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#666",
                          lineHeight: 1.4
                        }}>
                        {permission.desc}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        background: "#e8f5e8",
                        color: "#2e7d32"
                      }}>
                      ✓ Granted
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div>
              <div
                style={{
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "1px solid #e9ecef"
                }}>
                <h2
                  style={{
                    fontSize: "20px",
                    color: "#333",
                    marginBottom: "15px"
                  }}>
                  📸 Screenshot Settings
                </h2>
                <p
                  style={{
                    color: "#666",
                    lineHeight: 1.6,
                    marginBottom: "20px"
                  }}>
                  Customize how screenshots are captured and saved:
                </p>

                {/* Default Format */}
                <div
                  style={{
                    background: "white",
                    borderRadius: "8px",
                    padding: "20px",
                    marginBottom: "15px",
                    border: "1px solid #e0e0e0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                  <div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#333",
                        marginBottom: "5px"
                      }}>
                      Default Format
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        lineHeight: 1.4
                      }}>
                      Choose the default image format for screenshots
                    </div>
                  </div>
                  <select
                    value={settings.defaultFormat || "png"}
                    onChange={(e) =>
                      handleSettingChange("defaultFormat", e.target.value)
                    }
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      fontSize: "14px",
                      background: "white",
                      cursor: "pointer"
                    }}>
                    <option value="png">PNG (Lossless)</option>
                    <option value="jpeg">JPEG (Smaller)</option>
                  </select>
                </div>

                {/* Auto Download Toggle */}
                <div
                  style={{
                    background: "white",
                    borderRadius: "8px",
                    padding: "20px",
                    marginBottom: "15px",
                    border: "1px solid #e0e0e0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                  <div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#333",
                        marginBottom: "5px"
                      }}>
                      Auto Download
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        lineHeight: 1.4
                      }}>
                      Automatically download screenshots after capture
                    </div>
                  </div>
                  <div
                    onClick={() =>
                      handleSettingChange(
                        "autoDownload",
                        !settings.autoDownload
                      )
                    }
                    style={{
                      position: "relative",
                      width: "50px",
                      height: "24px",
                      background: settings.autoDownload ? "#667eea" : "#ccc",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "background 0.3s ease"
                    }}>
                    <div
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: settings.autoDownload ? "26px" : "2px",
                        width: "20px",
                        height: "20px",
                        background: "white",
                        borderRadius: "50%",
                        transition: "left 0.3s ease"
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "documentation" && (
            <div>
              <div
                style={{
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "1px solid #e9ecef"
                }}>
                <h2
                  style={{
                    fontSize: "20px",
                    color: "#333",
                    marginBottom: "15px"
                  }}>
                  📋 Documentation & SOP Management
                </h2>
                <p
                  style={{
                    color: "#666",
                    lineHeight: 1.6,
                    marginBottom: "20px"
                  }}>
                  Create Standard Operating Procedures, capture knowledge, and
                  manage your documentation workflow.
                </p>

                <div
                  style={{
                    background: "#e3f2fd",
                    borderLeft: "4px solid #2196f3",
                    color: "#1976d2",
                    padding: "15px",
                    borderRadius: "8px",
                    marginBottom: "20px"
                  }}>
                  <strong>📋 Documentation Features:</strong> The documentation
                  tools are now available directly in the main popup, right
                  after the title section. Look for the blue "Documentation &
                  SOP Tools" section when you open the extension.
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    marginBottom: "20px"
                  }}>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "8px",
                      padding: "20px",
                      border: "1px solid #e0e0e0"
                    }}>
                    <h3
                      style={{
                        fontSize: "16px",
                        color: "#333",
                        marginBottom: "10px"
                      }}>
                      📋 SOP Creator
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        lineHeight: 1.4
                      }}>
                      Create Standard Operating Procedures with titles,
                      descriptions, and integrated screenshots.
                    </p>
                    <ul
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        paddingLeft: "20px"
                      }}>
                      <li>Real-time SOP creation</li>
                      <li>Chrome storage integration</li>
                      <li>Screenshot capture</li>
                      <li>Persistent data storage</li>
                    </ul>
                  </div>

                  <div
                    style={{
                      background: "white",
                      borderRadius: "8px",
                      padding: "20px",
                      border: "1px solid #e0e0e0"
                    }}>
                    <h3
                      style={{
                        fontSize: "16px",
                        color: "#333",
                        marginBottom: "10px"
                      }}>
                      🧠 Knowledge Capture
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        lineHeight: 1.4
                      }}>
                      Capture important information, notes, and insights with
                      automatic URL tracking.
                    </p>
                    <ul
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        paddingLeft: "20px"
                      }}>
                      <li>Quick knowledge capture</li>
                      <li>URL context tracking</li>
                      <li>Searchable content</li>
                      <li>Organized storage</li>
                    </ul>
                  </div>
                </div>

                <div
                  style={{
                    background: "white",
                    borderRadius: "8px",
                    padding: "20px",
                    border: "1px solid #e0e0e0",
                    marginBottom: "20px"
                  }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      color: "#333",
                      marginBottom: "15px"
                    }}>
                    🚀 How to Use Documentation Features
                  </h3>
                  <ol
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      lineHeight: 1.6,
                      paddingLeft: "20px"
                    }}>
                    <li>
                      <strong>Open Extension:</strong> Click the Multi-Tool Pro
                      icon
                    </li>
                    <li>
                      <strong>Find Documentation Section:</strong> Look for the
                      blue "Documentation & SOP Tools" section right after the
                      title
                    </li>
                    <li>
                      <strong>Choose Your Tool:</strong>
                      <ul style={{ marginTop: "8px", fontSize: "13px" }}>
                        <li>
                          📋 Create SOP - For standard operating procedures
                        </li>
                        <li>
                          🧠 Knowledge - For capturing important information
                        </li>
                        <li>📄 View All - To see your saved documentation</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Create Content:</strong> Fill in the forms and
                      click the action buttons
                    </li>
                    <li>
                      <strong>Capture Screenshots:</strong> Use the 📸 button
                      for visual documentation
                    </li>
                  </ol>
                </div>

                <div
                  style={{
                    background: "#fff3e0",
                    borderLeft: "4px solid #ff9800",
                    color: "#e65100",
                    padding: "15px",
                    borderRadius: "8px"
                  }}>
                  <strong>💡 Pro Tip:</strong> All your documentation is
                  automatically saved to Chrome's local storage and persists
                  between browser sessions. Your data stays private and secure
                  on your device.
                </div>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div>
              <div
                style={{
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "1px solid #e9ecef"
                }}>
                <h2
                  style={{
                    fontSize: "20px",
                    color: "#333",
                    marginBottom: "15px"
                  }}>
                  📊 Usage Analytics
                </h2>
                <p
                  style={{
                    color: "#666",
                    lineHeight: 1.6,
                    marginBottom: "20px"
                  }}>
                  Track your extension usage and productivity insights:
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "20px"
                  }}>
                  {[
                    {
                      label: "Screenshots",
                      value: analytics.totalScreenshots || 0,
                      icon: "📸"
                    },
                    {
                      label: "Recordings",
                      value: analytics.totalRecordings || 0,
                      icon: "🎥"
                    },
                    {
                      label: "Colors Picked",
                      value: analytics.featureUsage?.colorPicker || 0,
                      icon: "🎨"
                    },
                    {
                      label: "Total Actions",
                      value: Object.values(analytics.featureUsage || {}).reduce(
                        (a: number, b: number) => a + b,
                        0
                      ),
                      icon: "⚡"
                    }
                  ].map((stat, index) => (
                    <div
                      key={index}
                      style={{
                        background: "white",
                        borderRadius: "8px",
                        padding: "20px",
                        border: "1px solid #e0e0e0",
                        textAlign: "center"
                      }}>
                      <div style={{ fontSize: "32px", marginBottom: "10px" }}>
                        {stat.icon}
                      </div>
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: "600",
                          color: "#333",
                          marginBottom: "5px"
                        }}>
                        {stat.value}
                      </div>
                      <div style={{ fontSize: "14px", color: "#666" }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "features" && (
            <div>
              <div
                style={{
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "1px solid #e9ecef"
                }}>
                <h2
                  style={{
                    fontSize: "20px",
                    color: "#333",
                    marginBottom: "15px"
                  }}>
                  🛠️ Available Features
                </h2>
                <p
                  style={{
                    color: "#666",
                    lineHeight: 1.6,
                    marginBottom: "20px"
                  }}>
                  Explore all the powerful tools available in Multi-Tool Pro:
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: "20px"
                  }}>
                  {[
                    {
                      icon: "📸",
                      title: "Advanced Screenshots",
                      desc: "6 capture modes including full-page stitching"
                    },
                    {
                      icon: "🎥",
                      title: "Screen Recording",
                      desc: "High-quality video capture with audio"
                    },
                    {
                      icon: "🎨",
                      title: "Color Picker",
                      desc: "Extract colors from any webpage element"
                    },
                    {
                      icon: "🔍",
                      title: "Page Zoom",
                      desc: "Zoom in/out for detailed inspection"
                    },
                    {
                      icon: "🛠️",
                      title: "Pro Tools",
                      desc: "15 advanced productivity tools"
                    },
                    {
                      icon: "♿",
                      title: "Accessibility",
                      desc: "WCAG compliance checking tools"
                    }
                  ].map((feature, index) => (
                    <div
                      key={index}
                      style={{
                        background: "white",
                        borderRadius: "8px",
                        padding: "20px",
                        border: "1px solid #e0e0e0",
                        textAlign: "center"
                      }}>
                      <div style={{ fontSize: "32px", marginBottom: "10px" }}>
                        {feature.icon}
                      </div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#333",
                          marginBottom: "8px"
                        }}>
                        {feature.title}
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#666",
                          lineHeight: 1.4
                        }}>
                        {feature.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div>
              <div
                style={{
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "1px solid #e9ecef"
                }}>
                <h2
                  style={{
                    fontSize: "20px",
                    color: "#333",
                    marginBottom: "15px"
                  }}>
                  ℹ️ About Multi-Tool Pro
                </h2>
                <p
                  style={{
                    color: "#666",
                    lineHeight: 1.6,
                    marginBottom: "20px"
                  }}>
                  Version 2.0.0 - A comprehensive browser extension for
                  productivity and web development.
                </p>

                <div
                  style={{
                    background: "white",
                    borderRadius: "8px",
                    padding: "20px",
                    border: "1px solid #e0e0e0"
                  }}>
                  <h3 style={{ color: "#333", marginBottom: "15px" }}>
                    Latest Updates
                  </h3>
                  <ul
                    style={{
                      color: "#666",
                      lineHeight: 1.6,
                      paddingLeft: "20px"
                    }}>
                    <li>✨ Added 6 advanced screenshot modes</li>
                    <li>🔧 Implemented real full-page stitching</li>
                    <li>🎨 New annotation and markup tools</li>
                    <li>📏 Pixel ruler and grid overlay</li>
                    <li>♿ WCAG accessibility checker</li>
                    <li>🌙 Universal dark mode toggle</li>
                    <li>⚡ Performance monitoring tools</li>
                    <li>🎨 Live CSS injection editor</li>
                    <li>📖 Reader mode for clean viewing</li>
                    <li>🛡️ Enhanced privacy and security</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IndexOptions
