import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationProvider } from '../providers/configurationProvider';
import { TerminalProvider } from '../providers/terminalProvider';
import { getStartCommand } from '../utils/frameworkCommands';

export async function startServers(
    configProvider: ConfigurationProvider,
    terminalProvider: TerminalProvider
): Promise<void> {
    const config = configProvider.getConfig();

    // Validate configuration
    if (!config.frontend.path || !config.backend.path) {
        const action = await vscode.window.showWarningMessage(
            'Project not configured. Would you like to configure it now?',
            'Configure',
            'Cancel'
        );

        if (action === 'Configure') {
            vscode.commands.executeCommand('projectStarter.configure');
        }
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Get start commands
    const frontendCommand = getStartCommand(config.frontend.framework, 'frontend', config.frontend.customCommand);
    const backendCommand = getStartCommand(config.backend.framework, 'backend', config.backend.customCommand);

    // Create and start frontend terminal
    const frontendPath = path.join(workspaceRoot, config.frontend.path);
    const frontendTerminal = terminalProvider.createTerminal(
        '🎨 Frontend',
        frontendPath,
        'frontend'
    );

    // Create and start backend terminal
    const backendPath = path.join(workspaceRoot, config.backend.path);
    const backendTerminal = terminalProvider.createTerminal(
        '⚙️ Backend',
        backendPath,
        'backend'
    );

    // Show terminals
    frontendTerminal.show(true);

    // Run commands with a slight delay
    setTimeout(() => {
        terminalProvider.runCommand('🎨 Frontend', frontendCommand);
    }, 500);

    setTimeout(() => {
        backendTerminal.show(true);
        terminalProvider.runCommand('⚙️ Backend', backendCommand);
    }, 1000);

    // Show success message with error capture reminder
    vscode.window.showInformationMessage(
        '🚀 Servers starting! If you see an error, select the text and use "Project Starter: Copy Last Error" or click the button below.',
        'Capture Error from Clipboard'
    ).then((selection) => {
        if (selection === 'Capture Error from Clipboard') {
            terminalProvider.captureErrorFromClipboard();
        }
    });
}
