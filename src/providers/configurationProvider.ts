import * as vscode from 'vscode';

export interface ProjectConfig {
    frontend: {
        path: string;
        framework: string;
        customCommand: string;
    };
    backend: {
        path: string;
        framework: string;
        customCommand: string;
    };
}

export class ConfigurationProvider {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('projectStarter');
    }

    refresh(): void {
        this.config = vscode.workspace.getConfiguration('projectStarter');
    }

    getConfig(): ProjectConfig {
        this.refresh();
        return {
            frontend: {
                path: this.config.get<string>('frontend.path') || '',
                framework: this.config.get<string>('frontend.framework') || 'react-vite',
                customCommand: this.config.get<string>('frontend.customCommand') || ''
            },
            backend: {
                path: this.config.get<string>('backend.path') || '',
                framework: this.config.get<string>('backend.framework') || 'express',
                customCommand: this.config.get<string>('backend.customCommand') || ''
            }
        };
    }

    async setFrontendPath(path: string): Promise<void> {
        await this.config.update('frontend.path', path, vscode.ConfigurationTarget.Workspace);
    }

    async setFrontendFramework(framework: string): Promise<void> {
        await this.config.update('frontend.framework', framework, vscode.ConfigurationTarget.Workspace);
    }

    async setFrontendCustomCommand(command: string): Promise<void> {
        await this.config.update('frontend.customCommand', command, vscode.ConfigurationTarget.Workspace);
    }

    async setBackendPath(path: string): Promise<void> {
        await this.config.update('backend.path', path, vscode.ConfigurationTarget.Workspace);
    }

    async setBackendFramework(framework: string): Promise<void> {
        await this.config.update('backend.framework', framework, vscode.ConfigurationTarget.Workspace);
    }

    async setBackendCustomCommand(command: string): Promise<void> {
        await this.config.update('backend.customCommand', command, vscode.ConfigurationTarget.Workspace);
    }

    isConfigured(): boolean {
        const config = this.getConfig();
        return config.frontend.path !== '' && config.backend.path !== '';
    }
}
