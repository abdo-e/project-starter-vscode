import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationProvider } from '../providers/configurationProvider';

export class ConfigPanel {
    public static currentPanel: ConfigPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _configProvider: ConfigurationProvider;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, configProvider: ConfigurationProvider) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ConfigPanel.currentPanel) {
            ConfigPanel.currentPanel._panel.reveal(column);
            ConfigPanel.currentPanel._update();
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'projectStarterConfig',
            '🚀 Project Starter',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        ConfigPanel.currentPanel = new ConfigPanel(panel, extensionUri, configProvider);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, configProvider: ConfigurationProvider) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._configProvider = configProvider;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'selectFrontendFolder':
                        await this._selectFolder('frontend');
                        break;
                    case 'selectBackendFolder':
                        await this._selectFolder('backend');
                        break;
                    case 'setFrontendFramework':
                        await this._configProvider.setFrontendFramework(message.value);
                        break;
                    case 'setBackendFramework':
                        await this._configProvider.setBackendFramework(message.value);
                        break;
                    case 'setCustomCommand':
                        if (message.type === 'frontend') {
                            await this._configProvider.setFrontendCustomCommand(message.value);
                        } else {
                            await this._configProvider.setBackendCustomCommand(message.value);
                        }
                        break;
                    case 'startServers':
                        vscode.commands.executeCommand('projectStarter.start');
                        break;
                    case 'stopServers':
                        vscode.commands.executeCommand('projectStarter.stop');
                        break;
                    case 'refresh':
                        this._update();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _selectFolder(type: 'frontend' | 'backend') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Please open a workspace folder first.');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.Uri.file(workspaceRoot),
            openLabel: `Select ${type === 'frontend' ? 'Frontend' : 'Backend'} Folder`,
            title: `Select ${type === 'frontend' ? 'Frontend' : 'Backend'} Folder`
        });

        if (folderUri && folderUri.length > 0) {
            const relativePath = path.relative(workspaceRoot, folderUri[0].fsPath) || '.';
            if (type === 'frontend') {
                await this._configProvider.setFrontendPath(relativePath);
            } else {
                await this._configProvider.setBackendPath(relativePath);
            }
            this._update();
        }
    }

    private _update() {
        const config = this._configProvider.getConfig();
        this._panel.webview.html = this._getHtmlForWebview(config);
    }

    private _getHtmlForWebview(config: { frontend: any; backend: any }) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Starter</title>
    <style>
        :root {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --bg-card: #0f3460;
            --accent: #e94560;
            --accent-hover: #ff6b6b;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --success: #00d9a5;
            --border-radius: 12px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 24px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 32px;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 8px;
            background: linear-gradient(90deg, var(--accent), #ff8a9b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header p {
            color: var(--text-secondary);
            font-size: 1.1rem;
        }

        .cards-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }

        .card {
            background: rgba(15, 52, 96, 0.6);
            backdrop-filter: blur(10px);
            border-radius: var(--border-radius);
            padding: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 32px rgba(233, 69, 96, 0.2);
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }

        .card-icon {
            font-size: 2rem;
        }

        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
        }

        .form-group {
            margin-bottom: 16px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-size: 0.9rem;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .folder-selector {
            display: flex;
            gap: 8px;
        }

        .folder-path {
            flex: 1;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 0.9rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .folder-path.empty {
            color: var(--text-secondary);
            font-style: italic;
        }

        button {
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        select {
            width: 100%;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 0.9rem;
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 16px center;
        }

        select option {
            background: var(--bg-secondary);
            color: var(--text-primary);
        }

        input[type="text"] {
            width: 100%;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 0.9rem;
        }

        input[type="text"]:focus,
        select:focus {
            outline: none;
            border-color: var(--accent);
        }

        .actions {
            display: flex;
            gap: 16px;
            justify-content: center;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent), #ff6b6b);
            color: white;
            padding: 16px 48px;
            font-size: 1.1rem;
            box-shadow: 0 4px 24px rgba(233, 69, 96, 0.4);
        }

        .btn-primary:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 32px rgba(233, 69, 96, 0.6);
        }

        .btn-danger {
            background: rgba(233, 69, 96, 0.2);
            color: var(--accent);
            border: 1px solid var(--accent);
        }

        .btn-danger:hover {
            background: var(--accent);
            color: white;
        }

        .status {
            text-align: center;
            padding: 16px;
            margin-top: 24px;
            background: rgba(0, 217, 165, 0.1);
            border: 1px solid var(--success);
            border-radius: var(--border-radius);
            color: var(--success);
        }

        .status.unconfigured {
            background: rgba(233, 69, 96, 0.1);
            border-color: var(--accent);
            color: var(--accent);
        }

        .custom-command {
            margin-top: 12px;
            display: none;
        }

        .custom-command.visible {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Project Starter</h1>
            <p>Configure and launch your full-stack project with one click</p>
        </div>

        <div class="cards-container">
            <!-- Frontend Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">🎨</span>
                    <span class="card-title">Frontend</span>
                </div>
                
                <div class="form-group">
                    <label>Folder Path</label>
                    <div class="folder-selector">
                        <div class="folder-path ${config.frontend.path ? '' : 'empty'}">
                            ${config.frontend.path || 'No folder selected'}
                        </div>
                        <button class="btn-secondary" onclick="selectFrontendFolder()">Browse</button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Framework</label>
                    <select id="frontendFramework" onchange="setFrontendFramework(this.value)">
                        <option value="react-vite" ${config.frontend.framework === 'react-vite' ? 'selected' : ''}>React (Vite)</option>
                        <option value="react-cra" ${config.frontend.framework === 'react-cra' ? 'selected' : ''}>React (CRA)</option>
                        <option value="vue" ${config.frontend.framework === 'vue' ? 'selected' : ''}>Vue</option>
                        <option value="angular" ${config.frontend.framework === 'angular' ? 'selected' : ''}>Angular</option>
                        <option value="nextjs" ${config.frontend.framework === 'nextjs' ? 'selected' : ''}>Next.js</option>
                        <option value="nuxt" ${config.frontend.framework === 'nuxt' ? 'selected' : ''}>Nuxt</option>
                        <option value="svelte" ${config.frontend.framework === 'svelte' ? 'selected' : ''}>Svelte</option>
                        <option value="custom" ${config.frontend.framework === 'custom' ? 'selected' : ''}>Custom Command</option>
                    </select>
                </div>

                <div class="form-group custom-command ${config.frontend.framework === 'custom' ? 'visible' : ''}" id="frontendCustom">
                    <label>Custom Command</label>
                    <input type="text" placeholder="e.g., npm run dev" value="${config.frontend.customCommand || ''}" 
                           onchange="setCustomCommand('frontend', this.value)">
                </div>
            </div>

            <!-- Backend Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">⚙️</span>
                    <span class="card-title">Backend</span>
                </div>
                
                <div class="form-group">
                    <label>Folder Path</label>
                    <div class="folder-selector">
                        <div class="folder-path ${config.backend.path ? '' : 'empty'}">
                            ${config.backend.path || 'No folder selected'}
                        </div>
                        <button class="btn-secondary" onclick="selectBackendFolder()">Browse</button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Framework</label>
                    <select id="backendFramework" onchange="setBackendFramework(this.value)">
                        <option value="express" ${config.backend.framework === 'express' ? 'selected' : ''}>Express</option>
                        <option value="nestjs" ${config.backend.framework === 'nestjs' ? 'selected' : ''}>NestJS</option>
                        <option value="django" ${config.backend.framework === 'django' ? 'selected' : ''}>Django</option>
                        <option value="flask" ${config.backend.framework === 'flask' ? 'selected' : ''}>Flask</option>
                        <option value="fastapi" ${config.backend.framework === 'fastapi' ? 'selected' : ''}>FastAPI</option>
                        <option value="spring-boot" ${config.backend.framework === 'spring-boot' ? 'selected' : ''}>Spring Boot</option>
                        <option value="custom" ${config.backend.framework === 'custom' ? 'selected' : ''}>Custom Command</option>
                    </select>
                </div>

                <div class="form-group custom-command ${config.backend.framework === 'custom' ? 'visible' : ''}" id="backendCustom">
                    <label>Custom Command</label>
                    <input type="text" placeholder="e.g., npm run dev" value="${config.backend.customCommand || ''}"
                           onchange="setCustomCommand('backend', this.value)">
                </div>
            </div>
        </div>

        <div class="actions">
            <button class="btn-primary" onclick="startServers()">▶ Start Servers</button>
            <button class="btn-danger" onclick="stopServers()">⏹ Stop Servers</button>
        </div>

        <div class="status ${config.frontend.path && config.backend.path ? '' : 'unconfigured'}">
            ${config.frontend.path && config.backend.path
                ? '✅ Project configured and ready to start!'
                : '⚠️ Please select both frontend and backend folders to get started'}
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function selectFrontendFolder() {
            vscode.postMessage({ command: 'selectFrontendFolder' });
        }

        function selectBackendFolder() {
            vscode.postMessage({ command: 'selectBackendFolder' });
        }

        function setFrontendFramework(value) {
            vscode.postMessage({ command: 'setFrontendFramework', value });
            document.getElementById('frontendCustom').classList.toggle('visible', value === 'custom');
        }

        function setBackendFramework(value) {
            vscode.postMessage({ command: 'setBackendFramework', value });
            document.getElementById('backendCustom').classList.toggle('visible', value === 'custom');
        }

        function setCustomCommand(type, value) {
            vscode.postMessage({ command: 'setCustomCommand', type, value });
        }

        function startServers() {
            vscode.postMessage({ command: 'startServers' });
        }

        function stopServers() {
            vscode.postMessage({ command: 'stopServers' });
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        ConfigPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
