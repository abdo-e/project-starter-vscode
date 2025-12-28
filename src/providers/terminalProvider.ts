import * as vscode from 'vscode';
import { LogProvider } from './logProvider';
import { AIHelper } from '../utils/aiHelper';

interface TerminalInfo {
    terminal: vscode.Terminal;
    name: string;
    type: 'frontend' | 'backend';
}

export class TerminalProvider {
    private terminals: Map<string, TerminalInfo> = new Map();
    private lastError: string = '';
    private outputBuffer: Map<string, string> = new Map();
    private restartCounts: Map<string, number> = new Map();
    private lastCommands: Map<string, { command: string, cwd: string, type: 'frontend' | 'backend' }> = new Map();
    private autoRestartEnabled: boolean = false;

    constructor() {
        // Listen for terminal close events
        vscode.window.onDidCloseTerminal((closedTerminal) => {
            for (const [key, info] of this.terminals.entries()) {
                if (info.terminal === closedTerminal) {
                    LogProvider.getInstance().log(info.type.toUpperCase(), `Terminal "${info.name}" closed.`);
                    this.terminals.delete(key);

                    // Check if we should auto-restart
                    this.handlePotentialCrash(key);
                    break;
                }
            }
        });
    }

    public setAutoRestart(enabled: boolean) {
        this.autoRestartEnabled = enabled;
    }

    private async handlePotentialCrash(name: string) {
        if (!this.autoRestartEnabled) return;

        const lastCmd = this.lastCommands.get(name);
        if (!lastCmd) return;

        const count = this.restartCounts.get(name) || 0;
        if (count >= 3) {
            LogProvider.getInstance().log('SYSTEM', `Max restart attempts (3) reached for ${name}.`);
            vscode.window.showErrorMessage(`Server ${name} crashed multiple times. Auto-restart disabled for this session.`);
            return;
        }

        const delay = (count + 1) * 2000;
        LogProvider.getInstance().log('SYSTEM', `Server ${name} crashed. Restarting in ${delay / 1000}s... (Attempt ${count + 1}/3)`);

        this.restartCounts.set(name, count + 1);

        setTimeout(() => {
            const terminal = this.createTerminal(name, lastCmd.cwd, lastCmd.type);
            terminal.show(true);
            this.runCommand(name, lastCmd.command);
        }, delay);
    }

    createTerminal(name: string, cwd: string, type: 'frontend' | 'backend'): vscode.Terminal {
        // Close existing terminal with same name if exists
        const existing = this.terminals.get(name);
        if (existing) {
            existing.terminal.dispose();
            this.terminals.delete(name);
        }

        const terminal = vscode.window.createTerminal({
            name: name,
            cwd: cwd
        });

        LogProvider.getInstance().log(type.toUpperCase(), `Created terminal "${name}" in ${cwd}`);
        this.terminals.set(name, { terminal, name, type });
        this.outputBuffer.set(name, '');

        return terminal;
    }

    runCommand(terminalName: string, command: string): void {
        const info = this.terminals.get(terminalName);
        if (info) {
            const cwd = (info.terminal.creationOptions as vscode.TerminalOptions).cwd as string;
            this.lastCommands.set(terminalName, { command, cwd, type: info.type });

            info.terminal.show();
            info.terminal.sendText(command);
            LogProvider.getInstance().log(info.type.toUpperCase(), `Running command: ${command}`);

            // Set up error monitoring
            this.monitorForErrors(terminalName);
        }
    }

    private monitorForErrors(terminalName: string): void {
        // Since VS Code doesn't provide direct terminal output access,
        // we'll use a workaround with shell integration if available
        // For now, we'll provide a manual error capture mechanism

        setTimeout(() => {
            // Show notification asking user if there were any errors
            this.showErrorCheckNotification(terminalName);
        }, 5000);
    }

    private showErrorCheckNotification(terminalName: string): void {
        // This will be enhanced with the error capture button
    }

    setLastError(error: string): void {
        this.lastError = error;
    }

    getLastError(): string {
        return this.lastError;
    }

    async captureErrorFromClipboard(): Promise<void> {
        const clipboardText = await vscode.env.clipboard.readText();
        if (clipboardText) {
            this.lastError = clipboardText;
            vscode.window.showInformationMessage('Error captured! Use "Copy Last Error" to copy it again.');
        }
    }

    showError(error: string, source: 'frontend' | 'backend'): void {
        this.lastError = error;

        vscode.window.showErrorMessage(
            `Error in ${source}: ${error.substring(0, 100)}...`,
            'Copy Error',
            'Ask AI',
            'Dismiss'
        ).then(async (selection) => {
            if (selection === 'Copy Error') {
                vscode.env.clipboard.writeText(error);
                vscode.window.showInformationMessage('Error copied to clipboard!');
            } else if (selection === 'Ask AI') {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Analyzing error with AI...",
                    cancellable: false
                }, async (progress) => {
                    const analysis = await AIHelper.analyzeError(error);
                    await AIHelper.showAnalysis(analysis);
                });
            }
        });
    }

    disposeTerminal(name: string): void {
        const info = this.terminals.get(name);
        if (info) {
            this.lastCommands.delete(name); // Don't restart if manually disposed
            info.terminal.dispose();
            this.terminals.delete(name);
        }
    }

    disposeAll(): void {
        for (const [name, info] of this.terminals.entries()) {
            info.terminal.dispose();
        }
        this.terminals.clear();
    }

    getActiveTerminals(): string[] {
        return Array.from(this.terminals.keys());
    }

    hasRunningTerminals(): boolean {
        return this.terminals.size > 0;
    }
}
