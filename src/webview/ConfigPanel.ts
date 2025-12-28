import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationProvider } from '../providers/configurationProvider';
import { Detector } from '../utils/detector';
import { TemplateGenerator, TEMPLATES } from '../utils/templateGenerator';
import { TaskGenerator } from '../utils/taskGenerator';
import { EnvManager } from '../utils/envManager';
import { GitHubUtils } from '../utils/githubUtils';

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
                    case 'setActiveProfile':
                        await this._configProvider.setActiveProfile(message.value);
                        this._update();
                        break;
                    case 'setProfileCommand':
                        await this._configProvider.setProfileCommand(message.profile, message.type, message.value);
                        break;
                    case 'setUseDocker':
                        await this._configProvider.setUseDocker(message.value);
                        this._update();
                        break;
                    case 'setAutoRestart':
                        await this._configProvider.setAutoRestart(message.value);
                        this._update();
                        break;
                    case 'generateProject':
                        await this._handleGenerateProject(message.templateId);
                        break;
                    case 'generateTasks':
                        await this._handleGenerateTasks();
                        break;
                    case 'getEnv':
                        await this._handleGetEnv(message.type);
                        break;
                    case 'saveEnv':
                        await this._handleSaveEnv(message.type, message.env);
                        break;
                    case 'githubInit':
                        await this._handleGithubInit();
                        break;
                    case 'githubBoilerplate':
                        await this._handleGithubBoilerplate();
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

    private async _handleGenerateProject(templateId: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Please open a workspace folder first to generate a project inside it.');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.Uri.file(workspaceRoot),
            openLabel: 'Select Generation Directory',
            title: 'Select where to scaffold the new project'
        });

        if (folderUri && folderUri.length > 0) {
            try {
                await TemplateGenerator.generate(templateId, folderUri[0].fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to generate project: ${error.message}`);
            }
        }
    }

    private async _handleGetEnv(type: 'frontend' | 'backend') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const config = this._configProvider.getConfig();
        const relPath = type === 'frontend' ? config.frontend.path : config.backend.path;
        if (!relPath) return;

        const envPath = path.join(workspaceFolders[0].uri.fsPath, relPath, '.env');
        const env = EnvManager.readEnv(envPath);

        this._panel.webview.postMessage({
            command: 'envData',
            type,
            env
        });
    }

    private async _handleSaveEnv(type: 'frontend' | 'backend', env: Record<string, string>) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const config = this._configProvider.getConfig();
        const relPath = type === 'frontend' ? config.frontend.path : config.backend.path;
        if (!relPath) return;

        const envPath = path.join(workspaceFolders[0].uri.fsPath, relPath, '.env');

        try {
            EnvManager.writeEnv(envPath, env);
            vscode.window.showInformationMessage(`Successfully saved ${type} .env file!`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to save .env: ${error.message}`);
        }
    }

    private async _handleGithubInit() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        await GitHubUtils.initRepo(workspaceFolders[0].uri.fsPath);
    }

    private async _handleGithubBoilerplate() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        await GitHubUtils.generateBoilerplate(workspaceFolders[0].uri.fsPath);
    }

    private async _handleGenerateTasks() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const projectConfig = this._configProvider.getConfig();
        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        try {
            await TaskGenerator.generateTasks(projectConfig, workspaceRoot);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to generate tasks: ${error.message}`);
        }
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
            const folderPath = folderUri[0].fsPath;
            const relativePath = path.relative(workspaceRoot, folderPath) || '.';

            if (type === 'frontend') {
                await this._configProvider.setFrontendPath(relativePath);
                const detected = await Detector.detectFrontend(folderPath);
                if (detected) {
                    await this._configProvider.setFrontendFramework(detected);
                    vscode.window.showInformationMessage(`Detected frontend framework: ${detected}`);
                }
            } else {
                await this._configProvider.setBackendPath(relativePath);
                const detected = await Detector.detectBackend(folderPath);
                if (detected) {
                    await this._configProvider.setBackendFramework(detected);
                    vscode.window.showInformationMessage(`Detected backend framework: ${detected}`);
                }
            }
            this._update();
        }
    }

    private _update() {
        const config = this._configProvider.getConfig();
        this._panel.webview.html = this._getHtmlForWebview(config);
    }

    private _getHtmlForWebview(config: any) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let frontendRecommendation = '';
        let backendRecommendation = '';

        if (workspaceFolders && workspaceFolders.length > 0) {
            const root = workspaceFolders[0].uri.fsPath;
            if (config.frontend.path) {
                frontendRecommendation = Detector.recommendScript(path.join(root, config.frontend.path)) || '';
            }
            if (config.backend.path) {
                backendRecommendation = Detector.recommendScript(path.join(root, config.backend.path)) || '';
            }
        }

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

        .profile-selector {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 32px;
            background: rgba(255, 255, 255, 0.05);
            padding: 8px;
            border-radius: 50px;
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .profile-btn {
            padding: 8px 24px;
            border-radius: 25px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            background: transparent;
            color: var(--text-secondary);
        }

        .profile-btn.active {
            background: var(--accent);
            color: white;
            box-shadow: 0 4px 12px rgba(233, 69, 96, 0.3);
        }

        .profile-btn:hover:not(.active) {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
        }

        .profile-commands {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .profile-commands h3 {
            font-size: 1rem;
            margin-bottom: 12px;
            color: var(--accent);
        }

        .docker-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 32px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: var(--border-radius);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 26px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 255, 255, 0.1);
            transition: .4s;
            border-radius: 34px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: var(--success);
        }

        input:checked + .slider:before {
            transform: translateX(24px);
        }

        .docker-label {
            font-size: 1rem;
            color: var(--text-primary);
            font-weight: 500;
        }

        .settings-container {
            display: flex;
            justify-content: center;
            gap: 24px;
            margin-bottom: 32px;
        }

        .toggle-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: var(--border-radius);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .generator-section {
            margin-top: 48px;
            padding-top: 32px;
            border-top: 2px dashed rgba(255, 255, 255, 0.1);
        }

        .generator-title {
            text-align: center;
            margin-bottom: 24px;
            font-size: 1.5rem;
            color: var(--accent);
        }

        .template-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 20px;
        }

        .template-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: var(--border-radius);
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
            text-align: center;
        }

        .template-card:hover {
            border-color: var(--accent);
            background: rgba(233, 69, 96, 0.1);
        }

        .utilities-section {
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: var(--text-secondary);
        }

        .template-name {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .template-desc {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 16px;
            height: 40px;
            overflow: hidden;
        }

        .secrets-section {
            margin-top: 48px;
            padding-top: 32px;
            border-top: 2px dashed rgba(255, 255, 255, 0.1);
        }

        .secrets-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }

        .secrets-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: var(--border-radius);
            padding: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .secrets-list {
            margin-bottom: 16px;
            max-height: 200px;
            overflow-y: auto;
        }

        .secret-item {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 8px;
            margin-bottom: 8px;
            align-items: center;
        }

        .secret-item input {
            margin-bottom: 0;
            padding: 4px 8px;
            font-size: 0.85rem;
        }

        .btn-icon {
            padding: 4px;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
        }

        .btn-icon:hover {
            color: var(--accent);
        }

        .recommendation-badge {
            font-size: 0.75rem;
            color: var(--success);
            background: rgba(0, 217, 165, 0.1);
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
            display: inline-block;
            margin-top: 4px;
            border: 1px solid rgba(0, 217, 165, 0.3);
            transition: all 0.2s ease;
        }

        .recommendation-badge:hover {
            background: rgba(0, 217, 165, 0.2);
            border-color: var(--success);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Project Starter</h1>
            <p>Configure and launch your full-stack project with one click</p>
        </div>

        <div class="profile-selector">
            <button class="profile-btn ${config.activeProfile === 'dev' ? 'active' : ''}" onclick="setActiveProfile('dev')">Dev</button>
            <button class="profile-btn ${config.activeProfile === 'prod' ? 'active' : ''}" onclick="setActiveProfile('prod')">Prod</button>
            <button class="profile-btn ${config.activeProfile === 'test' ? 'active' : ''}" onclick="setActiveProfile('test')">Test</button>
        </div>

        <div class="settings-container">
            <div class="toggle-item">
                <span class="docker-label">🐳 Use Docker if available</span>
                <label class="switch">
                    <input type="checkbox" ${config.useDocker ? 'checked' : ''} onchange="setUseDocker(this.checked)">
                    <span class="slider"></span>
                </label>
            </div>

            <div class="toggle-item">
                <span class="docker-label">🔄 Auto Restart on Crash</span>
                <label class="switch">
                    <input type="checkbox" ${config.autoRestart ? 'checked' : ''} onchange="setAutoRestart(this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
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
                    <input type="text" id="frontendInput" placeholder="e.g., npm run dev" value="${config.frontend.customCommand || ''}" 
                           onchange="setCustomCommand('frontend', this.value)">
                    ${frontendRecommendation ? `
                        <div class="recommendation-badge" onclick="setCustomCommand('frontend', '${frontendRecommendation}'); document.getElementById('frontendInput').value='${frontendRecommendation}'">
                            💡 Use recommended: ${frontendRecommendation}
                        </div>
                    ` : ''}
                </div>

                <div class="profile-commands">
                    <h3>${config.activeProfile.toUpperCase()} Profile Command</h3>
                    <div class="form-group">
                        <label>Override Start Command</label>
                        <input type="text" placeholder="e.g., npm run build && serve dist" 
                               value="${config.profiles[config.activeProfile].frontend || ''}" 
                               onchange="setProfileCommand('${config.activeProfile}', 'frontend', this.value)">
                    </div>
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
                    <input type="text" id="backendInput" placeholder="e.g., npm run dev" value="${config.backend.customCommand || ''}"
                           onchange="setCustomCommand('backend', this.value)">
                    ${backendRecommendation ? `
                        <div class="recommendation-badge" onclick="setCustomCommand('backend', '${backendRecommendation}'); document.getElementById('backendInput').value='${backendRecommendation}'">
                            💡 Use recommended: ${backendRecommendation}
                        </div>
                    ` : ''}
                </div>

                <div class="profile-commands">
                    <h3>${config.activeProfile.toUpperCase()} Profile Command</h3>
                    <div class="form-group">
                        <label>Override Start Command</label>
                        <input type="text" placeholder="e.g., java -jar app.jar" 
                               value="${config.profiles[config.activeProfile].backend || ''}" 
                               onchange="setProfileCommand('${config.activeProfile}', 'backend', this.value)">
                    </div>
                </div>
            </div>
        </div>

        <div class="actions">
            <button class="btn-primary" onclick="startServers()">▶ Start Servers</button>
            <button class="btn-danger" onclick="stopServers()">⏹ Stop Servers</button>
        </div>

        <div class="utilities-section">
            <button class="btn-secondary btn-small" onclick="generateTasks()">📋 Generate VS Code Tasks</button>
        </div>

        <div class="status ${config.frontend.path && config.backend.path ? '' : 'unconfigured'}">
            ${config.frontend.path && config.backend.path
                ? '✅ Project configured and ready to start!'
                : '⚠️ Please select both frontend and backend folders to get started'}
        </div>

        <div class="generator-section">
            <h2 class="generator-title">🧙‍♂️ Project Template Generator</h2>
            <div class="template-grid">
                ${TEMPLATES.map(t => `
                    <div class="template-card">
                        <div class="template-name">${t.name}</div>
                        <div class="template-desc">${t.description}</div>
                        <button class="btn-primary btn-small" onclick="generateProject('${t.id}')">Scaffold Now</button>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="secrets-section">
            <h2 class="generator-title">🔑 Secrets Manager (.env)</h2>
            <div class="secrets-grid">
                <!-- Frontend Secrets -->
                <div class="secrets-card">
                    <h3>Frontend Secrets</h3>
                    <div id="frontendSecrets" class="secrets-list">
                        <!-- Populated by JS -->
                        <div class="status">Loading...</div>
                    </div>
                    <button class="btn-secondary btn-small" onclick="addSecret('frontend')">+ Add Variable</button>
                    <button class="btn-primary btn-small" onclick="saveEnv('frontend')">Save .env</button>
                </div>

                <!-- Backend Secrets -->
                <div class="secrets-card">
                    <h3>Backend Secrets</h3>
                    <div id="backendSecrets" class="secrets-list">
                        <!-- Populated by JS -->
                        <div class="status">Loading...</div>
                    </div>
                    <button class="btn-secondary btn-small" onclick="addSecret('backend')">+ Add Variable</button>
                    <button class="btn-primary btn-small" onclick="saveEnv('backend')">Save .env</button>
                </div>
            </div>
        </div>

        <div class="secrets-section">
            <h2 class="generator-title">🐙 GitHub & Documentation</h2>
            <div class="template-grid">
                <div class="template-card">
                    <div class="template-name">Git Initialization</div>
                    <div class="template-desc">Initialize a new Git repository and create an initial commit.</div>
                    <button class="btn-primary btn-small" onclick="githubInit()">Initialize Repo</button>
                </div>
                <div class="template-card">
                    <div class="template-name">Boilerplate Docs</div>
                    <div class="template-desc">Generate a professional .gitignore and a README.md file.</div>
                    <button class="btn-primary btn-small" onclick="githubBoilerplate()">Generate Files</button>
                </div>
            </div>
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

        function setActiveProfile(value) {
            vscode.postMessage({ command: 'setActiveProfile', value });
        }

        function setProfileCommand(profile, type, value) {
            vscode.postMessage({ command: 'setProfileCommand', profile, type, value });
        }

        function setUseDocker(value) {
            vscode.postMessage({ command: 'setUseDocker', value });
        }

        function setAutoRestart(value) {
            vscode.postMessage({ command: 'setAutoRestart', value });
        }

        function generateProject(templateId) {
            vscode.postMessage({ command: 'generateProject', templateId });
        }

        function generateTasks() {
            vscode.postMessage({ command: 'generateTasks' });
        }

        function startServers() {
            vscode.postMessage({ command: 'startServers' });
        }

        function stopServers() {
            vscode.postMessage({ command: 'stopServers' });
        }

        // Secrets Management
        let currentEnvs = {
            frontend: {},
            backend: {}
        };

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'envData') {
                currentEnvs[message.type] = message.env;
                renderSecrets(message.type);
            }
        });

        function renderSecrets(type) {
            const container = document.getElementById(type + 'Secrets');
            const env = currentEnvs[type];
            
            if (Object.keys(env).length === 0) {
                container.innerHTML = '<div class="status">No variables found.</div>';
                return;
            }

            let html = '';
            for (const [key, value] of Object.entries(env)) {
                html += '<div class="secret-item">' +
                        '<input type="text" value="' + key + '" onchange="updateSecretKey(\'' + type + '\', \'' + key + '\', this.value)" placeholder="KEY">' +
                        '<input type="text" value="' + value + '" onchange="updateSecretValue(\'' + type + '\', \'' + key + '\', this.value)" placeholder="VALUE">' +
                        '<button class="btn-icon" onclick="deleteSecret(\'' + type + '\', \'' + key + '\')">🗑️</button>' +
                        '</div>';
            }
            container.innerHTML = html;
        }

        function addSecret(type) {
            const key = 'NEW_VAR_' + Date.now();
            currentEnvs[type][key] = '';
            renderSecrets(type);
        }

        function updateSecretKey(type, oldKey, newKey) {
            const value = currentEnvs[type][oldKey];
            delete currentEnvs[type][oldKey];
            currentEnvs[type][newKey] = value;
        }

        function updateSecretValue(type, key, value) {
            currentEnvs[type][key] = value;
        }

        function deleteSecret(type, key) {
            delete currentEnvs[type][key];
            renderSecrets(type);
        }

        function saveEnv(type) {
            vscode.postMessage({ 
                command: 'saveEnv', 
                type, 
                env: currentEnvs[type] 
            });
        }

        function githubInit() {
            vscode.postMessage({ command: 'githubInit' });
        }

        function githubBoilerplate() {
            vscode.postMessage({ command: 'githubBoilerplate' });
        }

        // Initial Load
        vscode.postMessage({ command: 'getEnv', type: 'frontend' });
        vscode.postMessage({ command: 'getEnv', type: 'backend' });
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
