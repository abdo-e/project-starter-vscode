import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    frontendFramework: string;
    backendFramework: string;
    commands: {
        frontend: string;
        backend: string;
    };
}

export const TEMPLATES: ProjectTemplate[] = [
    {
        id: 'react-express',
        name: 'React + Express',
        description: 'Vite React frontend with an Express backend.',
        frontendFramework: 'react-vite',
        backendFramework: 'express',
        commands: {
            frontend: 'npx create-vite@latest frontend --template react-ts',
            backend: 'mkdir backend && cd backend && npm init -y && npm install express'
        }
    },
    {
        id: 'nextjs-fastapi',
        name: 'Next.js + FastAPI',
        description: 'Next.js frontend with a Python FastAPI backend.',
        frontendFramework: 'nextjs',
        backendFramework: 'fastapi',
        commands: {
            frontend: 'npx create-next-app@latest frontend --ts --tailwind --eslint',
            backend: 'mkdir backend && cd backend && python -m venv venv'
        }
    }
];

export class TemplateGenerator {
    public static async generate(templateId: string, baseDir: string): Promise<void> {
        const template = TEMPLATES.find(t => t.id === templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found.`);
        }

        const terminal = vscode.window.createTerminal(`🚀 Scaffolding ${template.name}`);
        terminal.show();

        // Navigate to base directory
        terminal.sendText(`cd "${baseDir}"`);

        // Run frontend command
        terminal.sendText(template.commands.frontend);

        // Run backend command
        terminal.sendText(template.commands.backend);

        vscode.window.showInformationMessage(`Scaffolding ${template.name}... Check the terminal for progress.`);
    }
}
