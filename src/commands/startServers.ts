import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationProvider } from '../providers/configurationProvider';
import { TerminalProvider } from '../providers/terminalProvider';
import { getStartCommand } from '../utils/frameworkCommands';
import { PortUtils } from '../utils/portUtils';
import { DependencyUtils } from '../utils/dependencyUtils';
import { LogProvider } from '../providers/logProvider';
import { DockerUtils } from '../utils/dockerUtils';

export async function startServers(
    configProvider: ConfigurationProvider,
    terminalProvider: TerminalProvider
): Promise<void> {
    const config = configProvider.getConfig();
    const logger = LogProvider.getInstance();
    logger.clear();
    logger.show();
    logger.log('SYSTEM', 'Starting project servers...');

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
    const frontendPath = path.join(workspaceRoot, config.frontend.path);
    const backendPath = path.join(workspaceRoot, config.backend.path);

    // Get start commands
    let frontendCommand = getStartCommand(config.frontend.framework, 'frontend', config.frontend.customCommand);
    let backendCommand = getStartCommand(config.backend.framework, 'backend', config.backend.customCommand);

    // Override with profile commands if set
    const activeProfile = config.profiles[config.activeProfile];
    if (activeProfile) {
        if (activeProfile.frontend) {
            frontendCommand = activeProfile.frontend;
            logger.log('SYSTEM', `Using ${config.activeProfile} profile command for Frontend: ${frontendCommand}`);
        }
        if (activeProfile.backend) {
            backendCommand = activeProfile.backend;
            logger.log('SYSTEM', `Using ${config.activeProfile} profile command for Backend: ${backendCommand}`);
        }
    }

    // Check for Docker overrides
    if (config.useDocker) {
        const frontendDockerCmd = await DockerUtils.getDockerCommand(frontendPath);
        if (frontendDockerCmd) {
            frontendCommand = frontendDockerCmd;
            logger.log('SYSTEM', `Using Docker for Frontend: ${frontendCommand}`);
        }

        const backendDockerCmd = await DockerUtils.getDockerCommand(backendPath);
        if (backendDockerCmd) {
            backendCommand = backendDockerCmd;
            logger.log('SYSTEM', `Using Docker for Backend: ${backendCommand}`);
        }
    }

    // Check for port conflicts
    const frontendPort = PortUtils.getPortForFramework(config.frontend.framework, 'frontend');
    const backendPort = PortUtils.getPortForFramework(config.backend.framework, 'backend');

    const checkPort = async (port: number, name: string) => {
        const isAvailable = await PortUtils.isPortAvailable(port);
        if (!isAvailable) {
            const selection = await vscode.window.showErrorMessage(
                `Port ${port} is already in use by another process (${name}).`,
                'Kill Process',
                'Ignore',
                'Cancel'
            );

            if (selection === 'Kill Process') {
                const killed = await PortUtils.killProcessOnPort(port);
                if (!killed) {
                    logger.log('ERROR', `Failed to kill process on port ${port}.`);
                    vscode.window.showErrorMessage(`Failed to kill process on port ${port}.`);
                    return false;
                }
                logger.log('SYSTEM', `Killed process on port ${port}.`);
            } else if (selection === 'Cancel' || !selection) {
                logger.log('SYSTEM', `Startup cancelled due to port conflict on ${port}.`);
                return false;
            } else {
                logger.log('SYSTEM', `Ignoring port conflict on ${port}.`);
            }
        }
        return true;
    };

    if (!(await checkPort(frontendPort, 'Frontend'))) return;
    if (!(await checkPort(backendPort, 'Backend'))) return;

    // Check for dependencies

    const checkDeps = async (folderPath: string, framework: string, name: string) => {
        const hasDeps = await DependencyUtils.checkDependencies(folderPath, framework);
        if (!hasDeps) {
            const selection = await vscode.window.showWarningMessage(
                `Dependencies seem to be missing in ${name} (${framework}). Install now?`,
                'Install Now',
                'Skip',
                'Cancel'
            );

            if (selection === 'Install Now') {
                logger.log('SYSTEM', `Installing dependencies for ${name}...`);
                const terminal = vscode.window.createTerminal(`📦 Install ${name}`);
                terminal.show();
                terminal.sendText(`cd "${folderPath}"`);
                terminal.sendText(DependencyUtils.getInstallCommand(framework));

                // Wait for install to finish might be complex, so we'll just inform the user
                vscode.window.showInformationMessage(`Installing dependencies for ${name}... Please wait for it to finish before starting servers again.`);
                return false;
            } else if (selection === 'Cancel' || !selection) {
                logger.log('SYSTEM', `Startup cancelled by user during dependency check for ${name}.`);
                return false;
            } else {
                logger.log('SYSTEM', `Skipped dependency installation for ${name}.`);
            }
        }
        return true;
    };

    if (!(await checkDeps(frontendPath, config.frontend.framework, 'Frontend'))) return;
    if (!(await checkDeps(backendPath, config.backend.framework, 'Backend'))) return;

    // Create and start frontend terminal
    const frontendTerminal = terminalProvider.createTerminal(
        '🎨 Frontend',
        frontendPath,
        'frontend'
    );

    // Create and start backend terminal
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
    logger.log('SYSTEM', 'Servers started successfully.');
    vscode.window.showInformationMessage(
        '🚀 Servers starting! If you see an error, select the text and use "Project Starter: Copy Last Error" or click the button below.',
        'Capture Error from Clipboard'
    ).then((selection) => {
        if (selection === 'Capture Error from Clipboard') {
            terminalProvider.captureErrorFromClipboard();
        }
    });
}
