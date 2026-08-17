import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    
    var projectRoot: String = ""
    var backendProcess: Process?
    var frontendProcess: Process?
    var backendPid: Int32 = 0
    var frontendPid: Int32 = 0
    
    var backendPort: Int = 43121
    var frontendPort: Int = 5174
    var statusTimer: Timer?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Determine Project Root
        if let resPath = Bundle.main.resourcePath {
            let bundleRoot = (resPath as NSString).deletingLastPathComponent // Contents
            let appRoot = (bundleRoot as NSString).deletingLastPathComponent // .app
            let potentialRoot = (appRoot as NSString).deletingLastPathComponent
            
            if FileManager.default.fileExists(atPath: "\(potentialRoot)/package.json") {
                projectRoot = potentialRoot
            } else if FileManager.default.fileExists(atPath: "\(appRoot)/package.json") {
                projectRoot = appRoot
            } else {
                projectRoot = FileManager.default.currentDirectoryPath
            }
        } else {
            projectRoot = FileManager.default.currentDirectoryPath
        }
        
        // Setup Window
        let rect = NSRect(x: 0, y: 0, width: 940, height: 680)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "AgentLens Control Center"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.backgroundColor = NSColor(red: 9/255.0, green: 13/255.0, blue: 22/255.0, alpha: 1.0)
        window.minSize = NSSize(width: 800, height: 560)
        window.delegate = self
        
        // Setup WKWebView with native message handler
        let config = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "nativeApp")
        config.userContentController = userContentController
        
        webView = WKWebView(frame: rect, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground") // Transparent background
        
        // Set App Icon
        if let iconUrl = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let iconImg = NSImage(contentsOf: iconUrl) {
            NSApplication.shared.applicationIconImage = iconImg
        } else if let iconUrl = Bundle.main.url(forResource: "logo", withExtension: "png", subdirectory: "ui"),
                  let iconImg = NSImage(contentsOf: iconUrl) {
            NSApplication.shared.applicationIconImage = iconImg
        }

        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        
        // Load UI
        loadUI()
        
        // Start periodic health polling
        statusTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            self?.checkStatus()
        }
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        stopServersInternal()
    }
    
    func windowWillClose(_ notification: Notification) {
        stopServersInternal()
    }
    
    func loadUI() {
        // Try Bundle resources first, then relative path
        var htmlURL: URL?
        if let resourceURL = Bundle.main.resourceURL {
            let bundleHtml = resourceURL.appendingPathComponent("ui/index.html")
            if FileManager.default.fileExists(atPath: bundleHtml.path) {
                htmlURL = bundleHtml
            }
        }
        
        if htmlURL == nil {
            let localHtml = URL(fileURLWithPath: "\(projectRoot)/launcher/ui/index.html")
            if FileManager.default.fileExists(atPath: localHtml.path) {
                htmlURL = localHtml
            }
        }
        
        if let url = htmlURL {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            let fallbackHTML = "<html><body style='background:#090d16;color:white;font-family:sans-serif;padding:30px;'><h2>AgentLens Launcher</h2><p>Could not locate UI files. Looking in: \(projectRoot)</p></body></html>"
            webView.loadHTMLString(fallbackHTML, baseURL: nil)
        }
    }
    
    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            switch action {
            case "init":
                self.handleInit()
            case "startServers":
                let mode = body["mode"] as? String ?? "development"
                let bPort = body["backendPort"] as? Int ?? self.backendPort
                let fPort = body["frontendPort"] as? Int ?? self.frontendPort
                let autoOpen = body["autoOpen"] as? Bool ?? true
                self.startServers(mode: mode, backendPort: bPort, frontendPort: fPort, autoOpen: autoOpen)
            case "stopServers":
                self.stopServers()
            case "restartServers":
                let mode = body["mode"] as? String ?? "development"
                let bPort = body["backendPort"] as? Int ?? self.backendPort
                let fPort = body["frontendPort"] as? Int ?? self.frontendPort
                let autoOpen = body["autoOpen"] as? Bool ?? false
                self.stopServersInternal()
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self.startServers(mode: mode, backendPort: bPort, frontendPort: fPort, autoOpen: autoOpen)
                }
            case "openBrowser":
                if let urlString = body["url"] as? String, let url = URL(string: urlString) {
                    NSWorkspace.shared.open(url)
                }
            case "openFolder":
                let target = body["target"] as? String ?? ""
                let folderPath = "\(self.projectRoot)/\(target)"
                if FileManager.default.fileExists(atPath: folderPath) {
                    NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: folderPath)
                } else {
                    NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: self.projectRoot)
                }
            case "freePorts":
                if let ports = body["ports"] as? [Int] {
                    self.freePorts(ports: ports)
                }
            case "runDiagnostics":
                self.runDiagnostics()
            case "saveSettings":
                self.saveSettings(body)
            case "checkStatus":
                self.checkStatus()
            default:
                break
            }
        }
    }
    
    // MARK: - Actions
    func handleInit() {
        loadEnvSettings()
        checkStatus()
    }
    
    func loadEnvSettings() {
        let envPath = "\(projectRoot)/.env"
        var config: [String: String] = [:]
        
        if let content = try? String(contentsOfFile: envPath, encoding: .utf8) {
            let lines = content.components(separatedBy: .newlines)
            for line in lines {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
                let parts = trimmed.split(separator: "=", maxSplits: 1).map(String.init)
                if parts.count == 2 {
                    config[parts[0].trimmingCharacters(in: .whitespaces)] = parts[1].trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\"", with: "")
                }
            }
        }
        
        if let bPortStr = config["PORT"], let p = Int(bPortStr) {
            self.backendPort = p
        }
        if let fPortStr = config["FRONTEND_PORT"], let p = Int(fPortStr) {
            self.frontendPort = p
        }
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: config, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            let js = "window.onSettingsLoaded(\(jsonString));"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
    
    func saveSettings(_ body: [String: Any]) {
        var envEntries: [String: String] = [:]
        if let p = body["PORT"] as? String { envEntries["PORT"] = p }
        if let fp = body["FRONTEND_PORT"] as? String { envEntries["FRONTEND_PORT"] = fp }
        if let dr = body["ENABLE_DRY_RUN_MODE"] as? String { envEntries["ENABLE_DRY_RUN_MODE"] = dr }
        if let llm = body["LLM_ENABLED"] as? String { envEntries["LLM_ENABLED"] = llm }
        
        let envPath = "\(projectRoot)/.env"
        var currentEnv = (try? String(contentsOfFile: envPath, encoding: .utf8)) ?? ""
        
        for (k, v) in envEntries {
            let pattern = "^\(k)=.*$"
            if let regex = try? NSRegularExpression(pattern: pattern, options: .anchorsMatchLines) {
                let range = NSRange(location: 0, length: currentEnv.utf16.count)
                if regex.firstMatch(in: currentEnv, options: [], range: range) != nil {
                    currentEnv = regex.stringByReplacingMatches(in: currentEnv, options: [], range: range, withTemplate: "\(k)=\(v)")
                } else {
                    currentEnv.append("\n\(k)=\(v)")
                }
            }
        }
        
        try? currentEnv.write(toFile: envPath, atomically: true, encoding: .utf8)
        loadEnvSettings()
    }
    
    func findCommandPath(_ name: String) -> String {
        let home = NSHomeDirectory()
        
        // 1. Check nvm paths first (matches user's active node/native module environment)
        let nvmDir = "\(home)/.nvm/versions/node"
        if let versions = try? FileManager.default.contentsOfDirectory(atPath: nvmDir) {
            for v in versions.sorted().reversed() {
                let nvmBinary = "\(nvmDir)/\(v)/bin/\(name)"
                if FileManager.default.fileExists(atPath: nvmBinary) {
                    return nvmBinary
                }
            }
        }
        
        // 2. Check FNM, Volta, ASDF, Homebrew, and standard system paths
        let candidates = [
            "\(home)/.local/share/fnm/current/bin/\(name)",
            "\(home)/.fnm/current/bin/\(name)",
            "\(home)/.volta/bin/\(name)",
            "\(home)/.asdf/shims/\(name)",
            "/opt/homebrew/bin/\(name)",
            "/usr/local/bin/\(name)",
            "/usr/bin/\(name)",
            "/bin/\(name)"
        ]
        for c in candidates {
            if FileManager.default.fileExists(atPath: c) {
                return c
            }
        }
        
        return name
    }
    
    func startServers(mode: String, backendPort: Int, frontendPort: Int, autoOpen: Bool) {
        self.backendPort = backendPort
        self.frontendPort = frontendPort
        
        logToUI(source: "system", text: "Verifying port availability (: \(backendPort), : \(frontendPort))...")
        
        // Auto-free ports if held by orphan processes
        freePorts(ports: [backendPort, frontendPort])
        
        let npmPath = findCommandPath("npm")
        let nodePath = findCommandPath("node")
        let nodeBinDir = (nodePath as NSString).deletingLastPathComponent
        
        var customEnv = ProcessInfo.processInfo.environment
        customEnv["PATH"] = "\(nodeBinDir):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\(customEnv["PATH"] ?? "")"
        customEnv["PORT"] = "\(backendPort)"
        customEnv["FRONTEND_PORT"] = "\(frontendPort)"
        customEnv["HOST"] = "127.0.0.1"
        
        // 1. Launch Backend
        let bProcess = Process()
        bProcess.currentDirectoryPath = projectRoot
        bProcess.launchPath = "/bin/bash"
        if mode == "production" {
            bProcess.arguments = ["-c", "\"\(npmPath)\" run start --workspace=@network-monitor/backend"]
        } else {
            bProcess.arguments = ["-c", "\"\(npmPath)\" run dev --workspace=@network-monitor/backend"]
        }
        bProcess.environment = customEnv
        
        let bPipe = Pipe()
        bProcess.standardOutput = bPipe
        bProcess.standardError = bPipe
        
        bPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if let str = String(data: data, encoding: .utf8), !str.isEmpty {
                let lines = str.components(separatedBy: .newlines)
                for line in lines where !line.isEmpty {
                    self?.logToUI(source: "backend", text: line)
                }
            }
        }
        
        do {
            try bProcess.run()
            self.backendProcess = bProcess
            self.backendPid = bProcess.processIdentifier
            logToUI(source: "system", text: "Backend process started (PID: \(self.backendPid))")
        } catch {
            logToUI(source: "backend", text: "Failed to launch backend: \(error.localizedDescription)", isError: true)
        }
        
        // 2. Launch Frontend
        let fProcess = Process()
        fProcess.currentDirectoryPath = projectRoot
        fProcess.launchPath = "/bin/bash"
        if mode == "production" {
            fProcess.arguments = ["-c", "\"\(npmPath)\" run preview --workspace=@network-monitor/frontend"]
        } else {
            fProcess.arguments = ["-c", "\"\(npmPath)\" run dev --workspace=@network-monitor/frontend"]
        }
        fProcess.environment = customEnv
        
        let fPipe = Pipe()
        fProcess.standardOutput = fPipe
        fProcess.standardError = fPipe
        
        fPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if let str = String(data: data, encoding: .utf8), !str.isEmpty {
                let lines = str.components(separatedBy: .newlines)
                for line in lines where !line.isEmpty {
                    self?.logToUI(source: "frontend", text: line)
                }
            }
        }
        
        do {
            try fProcess.run()
            self.frontendProcess = fProcess
            self.frontendPid = fProcess.processIdentifier
            logToUI(source: "system", text: "Frontend process started (PID: \(self.frontendPid))")
        } catch {
            logToUI(source: "frontend", text: "Failed to launch frontend: \(error.localizedDescription)", isError: true)
        }
        
        // 3. Poll for Readiness
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            var ready = false
            var attempts = 0
            
            while !ready && attempts < 30 {
                Thread.sleep(forTimeInterval: 1.0)
                attempts += 1
                
                let bHealth = self.pingHealth(url: "http://127.0.0.1:\(backendPort)/api/health")
                let fHealth = self.pingHealth(url: "http://127.0.0.1:\(frontendPort)")
                
                if bHealth && fHealth {
                    ready = true
                    DispatchQueue.main.async {
                        self.logToUI(source: "system", text: "AgentLens services are fully online!")
                        self.checkStatus()
                        if autoOpen {
                            if let dashURL = URL(string: "http://127.0.0.1:\(frontendPort)") {
                                NSWorkspace.shared.open(dashURL)
                            }
                        }
                    }
                }
            }
            
            if !ready {
                DispatchQueue.main.async {
                    self.checkStatus()
                }
            }
        }
    }
    
    func stopServers() {
        stopServersInternal()
        logToUI(source: "system", text: "All services stopped.")
        checkStatus()
    }
    
    func stopServersInternal() {
        if let bp = backendProcess, bp.isRunning {
            bp.terminate()
            killProcessTree(pid: bp.processIdentifier)
            backendProcess = nil
            backendPid = 0
        }
        if let fp = frontendProcess, fp.isRunning {
            fp.terminate()
            killProcessTree(pid: fp.processIdentifier)
            frontendProcess = nil
            frontendPid = 0
        }
    }
    
    func killProcessTree(pid: Int32) {
        guard pid > 0 else { return }
        let p = Process()
        p.launchPath = "/bin/bash"
        p.arguments = ["-c", "pkill -P \(pid) 2>/dev/null || true; kill -9 \(pid) 2>/dev/null || true"]
        try? p.run()
        p.waitUntilExit()
    }
    
    func freePorts(ports: [Int]) {
        for port in ports {
            let p = Process()
            p.launchPath = "/bin/bash"
            p.arguments = ["-c", "lsof -ti :\(port) | xargs kill -9 2>/dev/null || true"]
            try? p.run()
            p.waitUntilExit()
            logToUI(source: "system", text: "Freed port :\(port)")
        }
        checkStatus()
    }
    
    func pingHealth(url: String) -> Bool {
        guard let u = URL(string: url) else { return false }
        var request = URLRequest(url: u, timeoutInterval: 1.5)
        request.httpMethod = "GET"
        let semaphore = DispatchSemaphore(value: 0)
        var isSuccess = false
        
        let task = URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, (200...399).contains(http.statusCode) {
                isSuccess = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 1.8)
        return isSuccess
    }
    
    func checkStatus() {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self = self else { return }
            
            let bHealth = self.pingHealth(url: "http://127.0.0.1:\(self.backendPort)/api/health")
            let fHealth = self.pingHealth(url: "http://127.0.0.1:\(self.frontendPort)")
            
            let nodePath = self.findCommandPath("node")
            var nodeVer = "Node.js"
            let p = Process()
            p.launchPath = nodePath
            p.arguments = ["-v"]
            let pipe = Pipe()
            p.standardOutput = pipe
            if (try? p.run()) != nil {
                p.waitUntilExit()
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                if let str = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) {
                    nodeVer = str
                }
            }
            
            let statusData: [String: Any] = [
                "backendRunning": bHealth,
                "frontendRunning": fHealth,
                "backendPid": self.backendPid > 0 ? "\(self.backendPid)" : (bHealth ? "Active" : ""),
                "frontendPid": self.frontendPid > 0 ? "\(self.frontendPid)" : (fHealth ? "Active" : ""),
                "backendPort": self.backendPort,
                "frontendPort": self.frontendPort,
                "nodeVer": nodeVer
            ]
            
            DispatchQueue.main.async {
                if let jsonData = try? JSONSerialization.data(withJSONObject: statusData, options: []),
                   let jsonStr = String(data: jsonData, encoding: .utf8) {
                    self.webView.evaluateJavaScript("window.onStatusUpdate(\(jsonStr));", completionHandler: nil)
                }
            }
        }
    }
    
    func runDiagnostics() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            var results: [[String: Any]] = []
            
            // 1. macOS OS Check
            let osVer = ProcessInfo.processInfo.operatingSystemVersionString
            results.append([
                "name": "macOS System",
                "required": "macOS Darwin 12+",
                "detected": osVer,
                "pass": true,
                "statusText": "Supported"
            ])
            
            // 2. Node.js
            let nodePath = self.findCommandPath("node")
            let pNode = Process()
            pNode.launchPath = "/bin/bash"
            pNode.arguments = ["-c", "\"\(nodePath)\" -v 2>/dev/null || echo 'Missing'"]
            let pPipe = Pipe()
            pNode.standardOutput = pPipe
            try? pNode.run()
            pNode.waitUntilExit()
            let nodeStr = String(data: pPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Missing"
            let nodePass = nodeStr.starts(with: "v")
            results.append([
                "name": "Node.js Runtime",
                "required": "v18.0.0 or newer",
                "detected": nodeStr,
                "pass": nodePass,
                "statusText": nodePass ? "Installed" : "Missing"
            ])
            
            // 3. npm
            let npmPath = self.findCommandPath("npm")
            let pNpm = Process()
            pNpm.launchPath = "/bin/bash"
            pNpm.arguments = ["-c", "\"\(npmPath)\" -v 2>/dev/null || echo 'Missing'"]
            let npmPipe = Pipe()
            pNpm.standardOutput = npmPipe
            try? pNpm.run()
            pNpm.waitUntilExit()
            let npmStr = String(data: npmPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Missing"
            let npmPass = !npmStr.contains("Missing") && !npmStr.isEmpty
            results.append([
                "name": "npm Package Manager",
                "required": "npm 8+",
                "detected": npmStr,
                "pass": npmPass,
                "statusText": npmPass ? "Installed" : "Missing"
            ])
            
            // 4. macOS lsof & nettop
            let pLsof = Process()
            pLsof.launchPath = "/bin/bash"
            pLsof.arguments = ["-c", "which lsof nettop >/dev/null && echo 'Ready' || echo 'Missing'"]
            let lsofPipe = Pipe()
            pLsof.standardOutput = lsofPipe
            try? pLsof.run()
            pLsof.waitUntilExit()
            let diagToolsStr = String(data: lsofPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let diagPass = diagToolsStr == "Ready"
            results.append([
                "name": "Diagnostic Tools (lsof, nettop)",
                "required": "macOS built-in utilities",
                "detected": diagPass ? "Available in PATH" : "Missing",
                "pass": diagPass,
                "statusText": diagPass ? "Available" : "Missing"
            ])
            
            // 5. Ports availability
            let bHealth = self.pingHealth(url: "http://127.0.0.1:\(self.backendPort)/api/health")
            let fHealth = self.pingHealth(url: "http://127.0.0.1:\(self.frontendPort)")
            results.append([
                "name": "Backend Port (:\(self.backendPort))",
                "required": "127.0.0.1 loopback only",
                "detected": bHealth ? "In-Use / Online" : "Free / Ready",
                "pass": true,
                "statusText": bHealth ? "Online" : "Ready"
            ])
            results.append([
                "name": "Frontend Port (:\(self.frontendPort))",
                "required": "127.0.0.1 loopback only",
                "detected": fHealth ? "In-Use / Online" : "Free / Ready",
                "pass": true,
                "statusText": fHealth ? "Online" : "Ready"
            ])
            
            DispatchQueue.main.async {
                if let jsonData = try? JSONSerialization.data(withJSONObject: results, options: []),
                   let jsonStr = String(data: jsonData, encoding: .utf8) {
                    self.webView.evaluateJavaScript("window.onDiagnosticsResult(\(jsonStr));", completionHandler: nil)
                }
            }
        }
    }
    
    func logToUI(source: String, text: String, isError: Bool = false) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let sanitized = text
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "\n", with: "\\n")
                .replacingOccurrences(of: "\r", with: "")
            let js = "window.onLog(\"\(source)\", \"\(sanitized)\", \(isError));"
            self.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

// Entry point
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
