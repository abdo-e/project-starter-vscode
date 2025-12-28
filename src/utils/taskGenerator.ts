import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectConfig } from '../providers/configurationProvider';
import { getStartCommand } from './frameworkCommands';

export class TaskGenerator {
    public static async generateTasks(config: ProjectConfig, workspaceRoot: string): Promise<void> {
        const vscodeDir = path.join(workspaceRoot, '.vscode');
        const tasksFile = path.join(vscodeDir, 'tasks.json');

        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir);
        }

        const frontendCmd = getStartCommand(config.frontend.framework, 'frontend', config.frontend.customCommand);
        const backendCmd = getStartCommand(config.backend.framework, 'backend', config.backend.customCommand);

        const tasksConfig = {
            version: "2.0.0",
            tasks: [
                {
                    label: "Start Frontend",
                    type: "shell",
                    command: frontendCmd,
                    options: {
                        cwd: path.join(workspaceRoot, config.frontend.path)
                    },
                    group: "none",
                    presentation: {
                        reveal: "always",
                        panel: "dedicated",
                        group: "servers"
                    }
                },
                {
                    label: "Start Backend",
                    type: "shell",
                    command: backendCmd,
                    options: {
                        cwd: path.join(workspaceRoot, config.backend.path)
                    },
                    group: "none",
                    presentation: {
                        reveal: "always",
                        panel: "dedicated",
                        group: "servers"
                    }
                },
                {
                    label: "Start All Servers",
                    dependsOn: ["Start Frontend", "Start Backend"],
                    group: {
                        kind: "build",
                        isDefault: true
                    }
                }
            ]
        };

        fs.writeFileSync(tasksFile, JSON.stringify(tasksConfig, null, 4));
        vscode.window.showInformationMessage('Successfully generated .vscode/tasks.json!');
    }
}
