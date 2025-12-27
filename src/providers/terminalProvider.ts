import * as vscode from 'vscode';

interface TerminalInfo {
    terminal: vscode.Terminal;
    name: string;
    type: 'frontend' | 'backend';
}

export class TerminalProvider {
    private terminals: Map<string, TerminalInfo> = new Map();
    private lastError: string = '';
    private outputBuffer: Map<string, string> = new Map();

    constructor() {
        // Listen for terminal close events
        vscode.window.onDidCloseTerminal((closedTerminal) => {
            for (const [key, info] of this.terminals.entries()) {
                if (info.terminal === closedTerminal) {
                    this.terminals.delete(key);
                    break;
                }
            }
        });
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

        this.terminals.set(name, { terminal, name, type });
        this.outputBuffer.set(name, '');

        return terminal;
    }

    runCommand(terminalName: string, command: string): void {
        const info = this.terminals.get(terminalName);
        if (info) {
            info.terminal.show();
            info.terminal.sendText(command);

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
            'Dismiss'
        ).then((selection) => {
            if (selection === 'Copy Error') {
                vscode.env.clipboard.writeText(error);
                vscode.window.showInformationMessage('Error copied to clipboard!');
            }
        });
    }

    disposeTerminal(name: string): void {
        const info = this.terminals.get(name);
        if (info) {
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
