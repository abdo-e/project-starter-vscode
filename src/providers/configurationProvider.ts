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
    activeProfile: 'dev' | 'prod' | 'test';
    profiles: {
        dev: { frontend: string; backend: string };
        prod: { frontend: string; backend: string };
        test: { frontend: string; backend: string };
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
            activeProfile: this.config.get<'dev' | 'prod' | 'test'>('activeProfile') || 'dev',
            profiles: this.config.get('profiles') || {
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
        this.refresh();
    }

    async setFrontendFramework(framework: string): Promise<void> {
        await this.config.update('frontend.framework', framework, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setFrontendCustomCommand(command: string): Promise<void> {
        await this.config.update('frontend.customCommand', command, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setBackendPath(path: string): Promise<void> {
        await this.config.update('backend.path', path, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setBackendFramework(framework: string): Promise<void> {
        await this.config.update('backend.framework', framework, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setBackendCustomCommand(command: string): Promise<void> {
        await this.config.update('backend.customCommand', command, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setActiveProfile(profile: 'dev' | 'prod' | 'test'): Promise<void> {
        await this.config.update('activeProfile', profile, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setProfileCommand(profile: string, type: 'frontend' | 'backend', command: string): Promise<void> {
        const profiles = JSON.parse(JSON.stringify(this.config.get<any>('profiles') || {
            dev: { frontend: '', backend: '' },
            prod: { frontend: '', backend: '' },
            test: { frontend: '', backend: '' }
        }));
        if (!profiles[profile]) {
            profiles[profile] = { frontend: '', backend: '' };
        }
        profiles[profile][type] = command;
        await this.config.update('profiles', profiles, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setUseDocker(use: boolean): Promise<void> {
        await this.config.update('useDocker', use, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    async setAutoRestart(auto: boolean): Promise<void> {
        await this.config.update('autoRestart', auto, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }



    isConfigured(): boolean {
        const config = this.getConfig();
        return config.frontend.path !== '' && config.backend.path !== '';
    }
}
