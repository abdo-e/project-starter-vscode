import * as vscode from 'vscode';
import { ConfigurationProvider } from './providers/configurationProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { ConfigPanel } from './webview/ConfigPanel';
import { configureProject } from './commands/configureProject';
import { startServers } from './commands/startServers';
import { stopServers } from './commands/stopServers';

let terminalProvider: TerminalProvider;
let statusBarStart: vscode.StatusBarItem;
let statusBarStop: vscode.StatusBarItem;
let statusBarConfig: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Starter extension is now active!');

    // Initialize providers
    const configProvider = new ConfigurationProvider();
    terminalProvider = new TerminalProvider();

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

    // Register commands
    const openDashboardCmd = vscode.commands.registerCommand('projectStarter.openDashboard', () => {
        ConfigPanel.createOrShow(context.extensionUri, configProvider);
    });

    const configureCmd = vscode.commands.registerCommand('projectStarter.configure', () => {
        configureProject(configProvider);
    });

    const startCmd = vscode.commands.registerCommand('projectStarter.start', () => {
        startServers(configProvider, terminalProvider);
    });

    const stopCmd = vscode.commands.registerCommand('projectStarter.stop', () => {
        stopServers(terminalProvider);
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

    context.subscriptions.push(
        openDashboardCmd,
        configureCmd,
        startCmd,
        stopCmd,
        copyErrorCmd,
        statusBarConfig,
        statusBarStart,
        statusBarStop
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
