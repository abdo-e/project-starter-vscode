import * as vscode from 'vscode';
import { TerminalProvider } from '../providers/terminalProvider';

export async function stopServers(terminalProvider: TerminalProvider): Promise<void> {
    const activeTerminals = terminalProvider.getActiveTerminals();

    if (activeTerminals.length === 0) {
        vscode.window.showInformationMessage('No servers are currently running.');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Stop ${activeTerminals.length} running server(s)?`,
        'Stop All',
        'Cancel'
    );

    if (confirm === 'Stop All') {
        terminalProvider.disposeAll();
        vscode.window.showInformationMessage('✅ All servers stopped.');
    }
}
