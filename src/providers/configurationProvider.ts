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
    activeProfile: string;
    profiles: {
        [key: string]: {
            frontend: string;
            backend: string;
        }
    };
    useDocker: boolean;
    autoRestart: boolean;
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
            },
            activeProfile: this.config.get<string>('activeProfile') || 'dev',
            profiles: this.config.get<any>('profiles') || {
                dev: { frontend: '', backend: '' },
                prod: { frontend: '', backend: '' },
                test: { frontend: '', backend: '' }
            },
            useDocker: this.config.get<boolean>('useDocker') || false,
            autoRestart: this.config.get<boolean>('autoRestart') || false
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

    async setActiveProfile(profile: string): Promise<void> {
        await this.config.update('activeProfile', profile, vscode.ConfigurationTarget.Workspace);
    }

    async setProfileCommand(profile: string, type: 'frontend' | 'backend', command: string): Promise<void> {
        const profiles = this.config.get<any>('profiles') || {};
        if (!profiles[profile]) {
            profiles[profile] = { frontend: '', backend: '' };
        }
        profiles[profile][type] = command;
        await this.config.update('profiles', profiles, vscode.ConfigurationTarget.Workspace);
    }

    async setUseDocker(use: boolean): Promise<void> {
        await this.config.update('useDocker', use, vscode.ConfigurationTarget.Workspace);
    }

    async setAutoRestart(auto: boolean): Promise<void> {
        await this.config.update('autoRestart', auto, vscode.ConfigurationTarget.Workspace);
    }

    isConfigured(): boolean {
        const config = this.getConfig();
        return config.frontend.path !== '' && config.backend.path !== '';
    }
}
