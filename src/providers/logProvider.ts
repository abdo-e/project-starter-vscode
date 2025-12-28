import * as vscode from 'vscode';

export class LogProvider {
    private static instance: LogProvider;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Project Starter Logs');
    }

    public static getInstance(): LogProvider {
        if (!LogProvider.instance) {
            LogProvider.instance = new LogProvider();
        }
        return LogProvider.instance;
    }

    /**
     * Appends a line to the output channel with a timestamp and source tag.
     */
    public log(source: string, message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] [${source}] ${message}`);
    }

    /**
     * Appends a raw message without timestamp/source.
     */
    public append(message: string): void {
        this.outputChannel.append(message);
    }

    /**
     * Appends a line without timestamp/source.
     */
    public appendLine(message: string): void {
        this.outputChannel.appendLine(message);
    }

    /**
     * Clears the output channel.
     */
    public clear(): void {
        this.outputChannel.clear();
    }

    /**
     * Shows the output channel.
     */
    public show(): void {
        this.outputChannel.show(true);
    }

    /**
     * Disposes the output channel.
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
