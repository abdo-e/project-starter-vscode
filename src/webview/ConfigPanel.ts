import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationProvider } from '../providers/configurationProvider';
import { Detector } from '../utils/detector';
import { TemplateGenerator, TEMPLATES } from '../utils/templateGenerator';
import { TaskGenerator } from '../utils/taskGenerator';
import { EnvManager } from '../utils/envManager';
import { GitHubUtils } from '../utils/githubUtils';
import { LogProvider } from '../providers/logProvider';

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

        if (ConfigPanel.currentPanel) {
            ConfigPanel.currentPanel._panel.reveal(column);
            ConfigPanel.currentPanel._update();
            return;
        }

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

        // Register message listener BEFORE update to avoid race conditions
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                LogProvider.getInstance().log('DASHBOARD', `Action: ${message.command}`);
                try {
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
                            break;
                        case 'setProfileCommand':
                            await this._configProvider.setProfileCommand(message.profile, message.type, message.value);
                            break;
                        case 'setUseDocker':
                            await this._configProvider.setUseDocker(message.value);
                            break;
                        case 'setAutoRestart':
                            await this._configProvider.setAutoRestart(message.value);
                            break;
                        case 'generateProject':
                            // Handle both value and templateId for robustness
                            await this._handleGenerateProject(message.value || message.templateId);
                            break;
                        case 'generateTasks':
                            await this._handleGenerateTasks();
                            break;
                        case 'getEnv':
                            await this._handleGetEnv(message.type || message.value);
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
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Dashboard action failed: ${error.message}`);
                }
            },
            null,
            this._disposables
        );

        // Auto-refresh webview when configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('projectStarter')) {
                this._update();
            }
        }, null, this._disposables);

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    private async _handleGenerateProject(templateId: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Please open a workspace folder first to generate a project inside it.');
            return;
        }

        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.Uri.file(workspaceFolders[0].uri.fsPath),
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
        this._panel.webview.postMessage({ command: 'envData', type, env });
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
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open. Open a folder to initialize Git.');
            return;
        }
        try {
            await GitHubUtils.initRepo(workspaceFolders[0].uri.fsPath);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Git init failed: ${error.message}`);
        }
    }

    private async _handleGithubBoilerplate() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open. Open a folder to generate GitHub Docs.');
            return;
        }
        try {
            await GitHubUtils.generateBoilerplate(workspaceFolders[0].uri.fsPath);
        } catch (error: any) {
            vscode.window.showErrorMessage(`GitHub Docs generation failed: ${error.message}`);
        }
    }

    private async _handleGenerateTasks() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return;
        await TaskGenerator.generateTasks(this._configProvider.getConfig(), workspaceFolders[0].uri.fsPath);
    }

    private async _selectFolder(type: 'frontend' | 'backend') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return;
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.Uri.file(workspaceFolders[0].uri.fsPath),
            openLabel: `Select ${type.charAt(0).toUpperCase() + type.slice(1)} Folder`
        });

        if (folderUri && folderUri.length > 0) {
            const relPath = path.relative(workspaceFolders[0].uri.fsPath, folderUri[0].fsPath) || '.';
            if (type === 'frontend') {
                await this._configProvider.setFrontendPath(relPath);
                const detected = await Detector.detectFrontend(folderUri[0].fsPath);
                if (detected) await this._configProvider.setFrontendFramework(detected);
            } else {
                await this._configProvider.setBackendPath(relPath);
                const detected = await Detector.detectBackend(folderUri[0].fsPath);
                if (detected) await this._configProvider.setBackendFramework(detected);
            }
            this._update();
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview(this._configProvider.getConfig());
    }

    public dispose() {
        ConfigPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    private _getHtmlForWebview(config: any) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let frontendRecommendation = '';
        let backendRecommendation = '';

        if (workspaceFolders && workspaceFolders.length > 0) {
            const root = workspaceFolders[0].uri.fsPath;
            if (config.frontend.path) frontendRecommendation = Detector.recommendScript(path.join(root, config.frontend.path)) || '';
            if (config.backend.path) backendRecommendation = Detector.recommendScript(path.join(root, config.backend.path)) || '';
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --accent: #38bdf8;
            --accent-glow: rgba(56, 189, 248, 0.3);
            --success: #10b981;
            --danger: #ef4444;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --border: rgba(255, 255, 255, 0.1);
            --radius: 16px;
        }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 var(--accent-glow); } 70% { box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); } 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Inter', -apple-system, sans-serif; 
            background-color: var(--bg); 
            color: var(--text); 
            padding: 40px 20px; 
            line-height: 1.5;
            background-image: 
                radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 100% 100%, rgba(56, 189, 248, 0.05) 0%, transparent 50%);
        }

        .container { max-width: 900px; margin: 0 auto; }
        
        .header { text-align: center; margin-bottom: 48px; animation: fadeIn 0.6s ease-out; }
        .header h1 { font-size: 3rem; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 12px; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header p { color: var(--text-muted); font-size: 1.125rem; }

        .profile-switcher { 
            display: flex; background: var(--card-bg); padding: 6px; border-radius: 50px; 
            width: fit-content; margin: 0 auto 40px; border: 1px solid var(--border);
            animation: fadeIn 0.6s ease-out 0.1s both;
        }
        .profile-btn { 
            padding: 10px 28px; border-radius: 50px; border: none; background: transparent; 
            color: var(--text-muted); cursor: pointer; font-weight: 600; transition: all 0.2s; 
        }
        .profile-btn.active { background: var(--accent); color: var(--bg); }

        .dashboard-grid { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 32px; 
            margin-bottom: 48px; animation: fadeIn 0.6s ease-out 0.2s both;
        }

        .glass-card { 
            background: var(--card-bg); backdrop-filter: blur(12px); border-radius: var(--radius); 
            padding: 32px; border: 1px solid var(--border); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-card:hover { border-color: var(--accent); transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); }

        .card-title { display: flex; align-items: center; gap: 12px; font-size: 1.5rem; font-weight: 700; margin-bottom: 24px; }
        .card-icon { font-size: 1.75rem; }

        .field-group { margin-bottom: 24px; }
        .label { display: block; font-size: 0.875rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        
        .input-row { display: flex; gap: 12px; }
        .path-display { 
            flex: 1; padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border); 
            border-radius: 8px; font-family: monospace; font-size: 0.9rem; color: var(--accent);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        
        select, input[type="text"] { 
            width: 100%; padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border); 
            border-radius: 8px; color: var(--text); font-size: 1rem; outline: none; transition: border-color 0.2s;
        }
        select:focus, input[type="text"]:focus { border-color: var(--accent); outline: none; }
        *:focus { outline: none; }
        button:focus { outline: none; }

        .btn { 
            padding: 12px 24px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; 
            transition: all 0.2s; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-ghost { background: var(--border); color: var(--text); }
        .btn-ghost:hover { background: rgba(255, 255, 255, 0.2); }
        .btn-primary { background: var(--accent); color: var(--bg); }
        .btn-primary:hover { transform: scale(1.02); filter: brightness(1.1); }
        .btn-start { 
            background: var(--accent); color: var(--bg); font-size: 1.25rem; padding: 20px 60px; 
            border-radius: 50px; animation: pulse 2s infinite; 
        }
        .btn-stop { background: var(--danger); color: white; border-radius: 50px; padding: 20px 40px; font-size: 1.25rem; }

        .recommendation { 
            margin-top: 12px; font-size: 0.875rem; color: var(--success); cursor: pointer; 
            display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; 
            background: rgba(16, 185, 129, 0.1); border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .main-actions { text-align: center; margin-bottom: 64px; animation: fadeIn 0.6s ease-out 0.3s both; display: flex; justify-content: center; gap: 24px; }

        .utility-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; animation: fadeIn 0.6s ease-out 0.4s both; }
        
        .section-tag { display: block; text-align: center; font-weight: 800; color: var(--text-muted); margin-bottom: 24px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.2em; }

        .secrets-manager { margin-top: 64px; animation: fadeIn 0.6s ease-out 0.5s both; }
        .secret-field { display: flex; gap: 12px; margin-bottom: 12px; }
        .secret-name { font-weight: 700; color: var(--accent); width: 140px; }

        .toggle-track { display: flex; align-items: center; gap: 12px; margin: 32px 0; justify-content: center; }
        input[type="checkbox"] { width: 44px; height: 24px; appearance: none; background: var(--border); border-radius: 20px; position: relative; cursor: pointer; transition: 0.3s; }
        input[type="checkbox"]:checked { background: var(--success); }
        input[type="checkbox"]::before { content: ''; position: absolute; width: 18px; height: 18px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: 0.3s; }
        input[type="checkbox"]:checked::before { left: 23px; }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

        .empty-state { text-align: center; padding: 40px; color: var(--text-muted); border: 2px dashed var(--border); border-radius: var(--radius); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" style="position: relative;">
            <h1>Project Starter</h1>
            <p>Your premium dashboard for effortless full-stack development</p>
            <button class="btn btn-ghost" style="position: absolute; right: 0; top: 0;" onclick="msg('refresh')">🔄 Refresh</button>
        </div>

        <div class="profile-switcher">
            <button class="profile-btn ${config.activeProfile === 'dev' ? 'active' : ''}" onclick="msg('setActiveProfile', 'dev')">Development</button>
            <button class="profile-btn ${config.activeProfile === 'prod' ? 'active' : ''}" onclick="msg('setActiveProfile', 'prod')">Production</button>
            <button class="profile-btn ${config.activeProfile === 'test' ? 'active' : ''}" onclick="msg('setActiveProfile', 'test')">Testing</button>
        </div>

        <div class="main-actions">
            <button class="btn btn-start" onclick="msg('startServers')">▶ START SERVERS</button>
            <button class="btn btn-stop" onclick="msg('stopServers')">⏹ STOP</button>
        </div>

        <div class="toggle-track">
            <span class="label">Auto-Restart</span>
            <input type="checkbox" ${config.autoRestart ? 'checked' : ''} onchange="msg('setAutoRestart', this.checked)">
            <span style="width: 24px"></span>
            <span class="label">Docker Mode</span>
            <input type="checkbox" ${config.useDocker ? 'checked' : ''} onchange="msg('setUseDocker', this.checked)">
        </div>

        <div class="dashboard-grid">
            <!-- Frontend Card -->
            <div class="glass-card">
                <div class="card-title"><span class="card-icon">🎨</span> Frontend</div>
                <div class="field-group">
                    <span class="label">Directory</span>
                    <div class="input-row">
                        <div class="path-display">${config.frontend.path || 'Root'}</div>
                        <button class="btn btn-ghost" onclick="msg('selectFrontendFolder')">Browse</button>
                    </div>
                </div>
                <div class="field-group">
                    <span class="label">Framework</span>
                    <select onchange="msg('setFrontendFramework', this.value)">
                        <option value="react-vite" ${config.frontend.framework === 'react-vite' ? 'selected' : ''}>React (Vite)</option>
                        <option value="nextjs" ${config.frontend.framework === 'nextjs' ? 'selected' : ''}>Next.js</option>
                        <option value="custom" ${config.frontend.framework === 'custom' ? 'selected' : ''}>Custom Command</option>
                    </select>
                </div>
                ${config.frontend.framework === 'custom' ? `
                    <div class="field-group">
                        <span class="label">Start Command</span>
                        <input type="text" id="fe-cmd" value="${config.frontend.customCommand || ''}" onchange="msg('setCustomCommand', {type:'frontend', value:this.value})">
                        ${frontendRecommendation ? `<div class="recommendation" onclick="setCmd('frontend', '${frontendRecommendation}')">💡 Recommended: ${frontendRecommendation}</div>` : ''}
                    </div>
                ` : ''}
            </div>

            <!-- Backend Card -->
            <div class="glass-card">
                <div class="card-title"><span class="card-icon">⚙️</span> Backend</div>
                <div class="field-group">
                    <span class="label">Directory</span>
                    <div class="input-row">
                        <div class="path-display">${config.backend.path || 'Root'}</div>
                        <button class="btn btn-ghost" onclick="msg('selectBackendFolder')">Browse</button>
                    </div>
                </div>
                <div class="field-group">
                    <span class="label">Framework</span>
                    <select onchange="msg('setBackendFramework', this.value)">
                        <option value="express" ${config.backend.framework === 'express' ? 'selected' : ''}>Express</option>
                        <option value="nestjs" ${config.backend.framework === 'nestjs' ? 'selected' : ''}>NestJS</option>
                        <option value="fastapi" ${config.backend.framework === 'fastapi' ? 'selected' : ''}>FastAPI</option>
                        <option value="custom" ${config.backend.framework === 'custom' ? 'selected' : ''}>Custom Command</option>
                    </select>
                </div>
                ${config.backend.framework === 'custom' ? `
                    <div class="field-group">
                        <span class="label">Start Command</span>
                        <input type="text" id="be-cmd" value="${config.backend.customCommand || ''}" onchange="msg('setCustomCommand', {type:'backend', value:this.value})">
                        ${backendRecommendation ? `<div class="recommendation" onclick="setCmd('backend', '${backendRecommendation}')">💡 Recommended: ${backendRecommendation}</div>` : ''}
                    </div>
                ` : ''}
            </div>
        </div>

        <span class="section-tag">Powerful Utilities</span>
        <div class="utility-grid">
            <div class="glass-card">
                <div class="card-title" style="font-size: 1.125rem"><span class="card-icon">📋</span> VS Code Tasks</div>
                <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:20px">Generate automated tasks to launch servers directly from the command palette.</p>
                <button class="btn btn-primary" style="width:100%" onclick="msg('generateTasks')">Generate Now</button>
            </div>
            <div class="glass-card">
                <div class="card-title" style="font-size: 1.125rem"><span class="card-icon">🐙</span> GitHub Setup</div>
                <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:20px">Initialize repository, create professional .gitignore and README.md files.</p>
                <div style="display:flex; gap:8px">
                    <button class="btn btn-ghost" style="flex:1" onclick="msg('githubInit')">Init Repo</button>
                    <button class="btn btn-ghost" style="flex:1" onclick="msg('githubBoilerplate')">Docs</button>
                </div>
            </div>
        </div>

        <span class="section-tag">Project Scaffolding</span>
        <div class="utility-grid" style="margin-top: 24px">
            <div class="glass-card">
                <div class="card-title" style="font-size: 1.125rem"><span class="card-icon">🧙‍♂️</span> MERN Stack</div>
                <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:20px">React + Express + MongoDB. Perfect for modern web apps.</p>
                <button class="btn btn-primary" style="width:100%" onclick="msg('generateProject', 'mern')">Scaffold MERN</button>
            </div>
            <div class="glass-card">
                <div class="card-title" style="font-size: 1.125rem"><span class="card-icon">🚀</span> Next.js Fullstack</div>
                <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:20px">Next.js + Prisma + Tailwind. The gold standard for SEO.</p>
                <button class="btn btn-primary" style="width:100%" onclick="msg('generateProject', 'nextjs-fullstack')">Scaffold Next.js</button>
            </div>
        </div>

        <div class="secrets-manager">
            <span class="section-tag">Secrets & Environment</span>
            <div class="dashboard-grid">
                <div class="glass-card">
                    <div class="card-title" style="font-size: 1.125rem">Frontend .env</div>
                    <div id="fe-secrets" class="secrets-list">Loading...</div>
                    <button class="btn btn-ghost" style="margin-top:16px; width:100%" onclick="saveSecrets('frontend')">Save Changes</button>
                </div>
                <div class="glass-card">
                    <div class="card-title" style="font-size: 1.125rem">Backend .env</div>
                    <div id="be-secrets" class="secrets-list">Loading...</div>
                    <button class="btn btn-ghost" style="margin-top:16px; width:100%" onclick="saveSecrets('backend')">Save Changes</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const currentEnvs = { frontend: {}, backend: {} };

        function msg(command, value = null) {
            if (value && value.type) {
                vscode.postMessage({ command, type: value.type, value: value.value });
            } else {
                vscode.postMessage({ command, value });
            }
        }

        function setCmd(type, val) {
            const el = document.getElementById(type === 'frontend' ? 'fe-cmd' : 'be-cmd');
            if (el) el.value = val;
            msg('setCustomCommand', {type, value: val});
        }

        window.addEventListener('message', event => {
            const m = event.data;
            if (m.command === 'envData') {
                currentEnvs[m.type] = m.env;
                renderSecrets(m.type);
            }
        });

        function renderSecrets(type) {
            const container = document.getElementById(type === 'frontend' ? 'fe-secrets' : 'be-secrets');
            const env = currentEnvs[type];
            let html = '';
            for (const [k, v] of Object.entries(env)) {
                html += \`
                    <div class="secret-field">
                        <span class="secret-name">\${k}</span>
                        <input type="text" value="\${v}" onchange="updateSecret('\${type}', '\${k}', this.value)">
                    </div>
                \`;
            }
            container.innerHTML = html || '<div class="empty-state">No .env found</div>';
        }

        function updateSecret(type, key, value) {
            currentEnvs[type][key] = value;
        }

        function saveSecrets(type) {
            vscode.postMessage({ command: 'saveEnv', type, env: currentEnvs[type] });
        }

        msg('getEnv', 'frontend');
        msg('getEnv', 'backend');
    </script>
</body>
</html>`;
    }
}
