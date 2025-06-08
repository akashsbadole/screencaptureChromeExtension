// Performance Monitor for Multi-Tool Pro Extension
// Add this script to monitor performance improvements

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoad: 0,
            tabSwitch: 0,
            analyticsLoad: 0,
            settingsLoad: 0,
            memoryUsage: 0,
            domNodes: 0
        };
        this.startTime = performance.now();
        this.init();
    }

    init() {
        this.measurePageLoad();
        this.measureMemoryUsage();
        this.measureDOMComplexity();
        this.setupTabSwitchMonitoring();
        this.setupAnalyticsMonitoring();
        this.logResults();
    }

    measurePageLoad() {
        window.addEventListener('load', () => {
            this.metrics.pageLoad = performance.now() - this.startTime;
            console.log(`📊 Page Load Time: ${this.metrics.pageLoad.toFixed(2)}ms`);
        });
    }

    measureMemoryUsage() {
        if (performance.memory) {
            this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
            console.log(`🧠 Memory Usage: ${this.metrics.memoryUsage.toFixed(2)}MB`);
        }
    }

    measureDOMComplexity() {
        this.metrics.domNodes = document.querySelectorAll('*').length;
        console.log(`🌳 DOM Nodes: ${this.metrics.domNodes}`);
    }

    setupTabSwitchMonitoring() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const startTime = performance.now();
                
                requestAnimationFrame(() => {
                    const endTime = performance.now();
                    this.metrics.tabSwitch = endTime - startTime;
                    console.log(`🔄 Tab Switch Time: ${this.metrics.tabSwitch.toFixed(2)}ms`);
                });
            });
        });
    }

    setupAnalyticsMonitoring() {
        // Monitor analytics loading
        const originalLoadAnalytics = window.loadAnalytics;
        if (originalLoadAnalytics) {
            window.loadAnalytics = () => {
                const startTime = performance.now();
                originalLoadAnalytics();
                
                requestAnimationFrame(() => {
                    const endTime = performance.now();
                    this.metrics.analyticsLoad = endTime - startTime;
                    console.log(`📈 Analytics Load Time: ${this.metrics.analyticsLoad.toFixed(2)}ms`);
                });
            };
        }
    }

    logResults() {
        setTimeout(() => {
            console.group('🚀 Performance Report - Multi-Tool Pro Options Page');
            console.log(`📊 Page Load: ${this.metrics.pageLoad.toFixed(2)}ms`);
            console.log(`🔄 Tab Switch: ${this.metrics.tabSwitch.toFixed(2)}ms`);
            console.log(`📈 Analytics Load: ${this.metrics.analyticsLoad.toFixed(2)}ms`);
            console.log(`🧠 Memory Usage: ${this.metrics.memoryUsage.toFixed(2)}MB`);
            console.log(`🌳 DOM Nodes: ${this.metrics.domNodes}`);
            
            // Performance recommendations
            this.generateRecommendations();
            console.groupEnd();
        }, 2000);
    }

    generateRecommendations() {
        console.group('💡 Performance Recommendations');
        
        if (this.metrics.pageLoad > 1000) {
            console.warn('⚠️ Page load time is high. Consider lazy loading more content.');
        } else {
            console.log('✅ Page load time is good!');
        }

        if (this.metrics.tabSwitch > 100) {
            console.warn('⚠️ Tab switching is slow. Consider optimizing animations.');
        } else {
            console.log('✅ Tab switching is smooth!');
        }

        if (this.metrics.memoryUsage > 50) {
            console.warn('⚠️ High memory usage detected. Check for memory leaks.');
        } else {
            console.log('✅ Memory usage is efficient!');
        }

        if (this.metrics.domNodes > 1000) {
            console.warn('⚠️ High DOM complexity. Consider virtual scrolling.');
        } else {
            console.log('✅ DOM complexity is manageable!');
        }

        console.groupEnd();
    }

    // Method to track custom metrics
    trackCustomMetric(name, startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
        return duration;
    }

    // Method to measure function performance
    measureFunction(fn, name) {
        return function(...args) {
            const startTime = performance.now();
            const result = fn.apply(this, args);
            const endTime = performance.now();
            console.log(`🔧 ${name}: ${(endTime - startTime).toFixed(2)}ms`);
            return result;
        };
    }
}

// Initialize performance monitoring
if (typeof window !== 'undefined') {
    window.performanceMonitor = new PerformanceMonitor();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}
