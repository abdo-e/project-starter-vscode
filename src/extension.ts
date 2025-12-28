import * as vscode from 'vscode';
import { ConfigurationProvider } from './providers/configurationProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { ConfigPanel } from './webview/ConfigPanel';
import { configureProject } from './commands/configureProject';
import { startServers } from './commands/startServers';
import { stopServers } from './commands/stopServers';
import { HealthChecker, HealthStatus } from './utils/healthChecker';
import { PortUtils } from './utils/portUtils';
import { AIHelper } from './utils/aiHelper';

let terminalProvider: TerminalProvider;
let statusBarStart: vscode.StatusBarItem;
let statusBarStop: vscode.StatusBarItem;
let statusBarConfig: vscode.StatusBarItem;
let statusBarFrontendHealth: vscode.StatusBarItem;
let statusBarBackendHealth: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Starter extension is now active!');

    // Initialize providers
    const configProvider = new ConfigurationProvider();
    terminalProvider = new TerminalProvider();

    // Set initial auto-restart state
    terminalProvider.setAutoRestart(configProvider.getConfig().autoRestart);

    // Create status bar items
    statusBarConfig = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
    statusBarConfig.text = '$(gear) Project Starter';
    statusBarConfig.tooltip = 'Open Project Starter Dashboard';
    statusBarConfig.command = 'projectStarter.openDashboard';
    statusBarConfig.show();

    statusBarStart = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarStart.text = '$(play) Start';
    statusBarStart.tooltip = 'Start frontend and backend servers';
    statusBarStart.command = 'projectStarter.start';
    statusBarStart.show();

    statusBarStop = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    statusBarStop.text = '$(debug-stop) Stop';
    statusBarStop.tooltip = 'Stop all running servers';
    statusBarStop.command = 'projectStarter.stop';
    statusBarStop.show();

    statusBarFrontendHealth = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    statusBarFrontendHealth.text = 'Frontend: $(circle-outline)';
    statusBarFrontendHealth.tooltip = 'Frontend Server Health';
    statusBarFrontendHealth.hide();

    statusBarBackendHealth = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
    statusBarBackendHealth.text = 'Backend: $(circle-outline)';
    statusBarBackendHealth.tooltip = 'Backend Server Health';
    statusBarBackendHealth.hide();

    // Register commands
    const openDashboardCmd = vscode.commands.registerCommand('projectStarter.openDashboard', () => {
        ConfigPanel.createOrShow(context.extensionUri, configProvider);
    });

    const configureCmd = vscode.commands.registerCommand('projectStarter.configure', () => {
        configureProject(configProvider);
    });

    const startCmd = vscode.commands.registerCommand('projectStarter.start', async () => {
        const config = configProvider.getConfig();
        terminalProvider.setAutoRestart(config.autoRestart);

        await startServers(configProvider, terminalProvider);

        // Start health monitoring
        const frontendPort = PortUtils.getPortForFramework(config.frontend.framework, 'frontend');
        const backendPort = PortUtils.getPortForFramework(config.backend.framework, 'backend');

        statusBarFrontendHealth.text = 'Frontend: $(sync~spin) Checking';
        statusBarFrontendHealth.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        statusBarFrontendHealth.show();

        statusBarBackendHealth.text = 'Backend: $(sync~spin) Checking';
        statusBarBackendHealth.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        statusBarBackendHealth.show();

        HealthChecker.getInstance().startMonitoring(frontendPort, backendPort);
    });

    const stopCmd = vscode.commands.registerCommand('projectStarter.stop', () => {
        stopServers(terminalProvider);
        HealthChecker.getInstance().stopMonitoring();
        statusBarFrontendHealth.hide();
        statusBarBackendHealth.hide();
    });

    const copyErrorCmd = vscode.commands.registerCommand('projectStarter.copyLastError', () => {
        const lastError = terminalProvider.getLastError();
        if (lastError) {
            vscode.env.clipboard.writeText(lastError);
            vscode.window.showInformationMessage('Error copied to clipboard!');
        } else {
            vscode.window.showInformationMessage('No error to copy.');
        }
    });

    const analyzeErrorCmd = vscode.commands.registerCommand('projectStarter.analyzeError', async () => {
        const lastError = terminalProvider.getLastError();
        if (lastError) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing error with AI...",
                cancellable: false
            }, async (progress) => {
                const analysis = await AIHelper.analyzeError(lastError);
                await AIHelper.showAnalysis(analysis);
            });
        } else {
            vscode.window.showInformationMessage('No error captured to analyze.');
        }
    });

    // Handle health status changes
    HealthChecker.getInstance().onStatusChange((type, status) => {
        const item = type === 'frontend' ? statusBarFrontendHealth : statusBarBackendHealth;
        const label = type === 'frontend' ? 'Frontend' : 'Backend';

        if (status === HealthStatus.Running) {
            item.text = `${label}: $(check) Running`;
            item.color = '#00d9a5';
        } else if (status === HealthStatus.Crashed) {
            item.text = `${label}: $(error) Crashed`;
            item.color = '#e94560';
        } else if (status === HealthStatus.Starting) {
            item.text = `${label}: $(sync~spin) Starting`;
            item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        }
    });

    context.subscriptions.push(
        openDashboardCmd,
        configureCmd,
        startCmd,
        stopCmd,
        copyErrorCmd,
        analyzeErrorCmd,
        statusBarConfig,
        statusBarStart,
        statusBarStop,
        statusBarFrontendHealth,
        statusBarBackendHealth
    );

    // Show welcome message on first activation
    const config = configProvider.getConfig();
    if (!config.frontend.path || !config.backend.path) {
        vscode.window.showInformationMessage(
            '🚀 Welcome to Project Starter! Click the gear icon in the status bar to configure your project.',
            'Open Dashboard'
        ).then(selection => {
            if (selection === 'Open Dashboard') {
                ConfigPanel.createOrShow(context.extensionUri, configProvider);
            }
        });
    }
}

export function deactivate() {
    if (terminalProvider) {
        terminalProvider.disposeAll();
    }
}
