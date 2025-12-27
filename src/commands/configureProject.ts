import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationProvider } from '../providers/configurationProvider';

const FRONTEND_FRAMEWORKS = [
    { label: 'React (Vite)', value: 'react-vite', description: 'npm run dev' },
    { label: 'React (Create React App)', value: 'react-cra', description: 'npm start' },
    { label: 'Vue', value: 'vue', description: 'npm run dev' },
    { label: 'Angular', value: 'angular', description: 'ng serve' },
    { label: 'Next.js', value: 'nextjs', description: 'npm run dev' },
    { label: 'Nuxt', value: 'nuxt', description: 'npm run dev' },
    { label: 'Svelte', value: 'svelte', description: 'npm run dev' },
    { label: 'Custom Command', value: 'custom', description: 'Specify your own command' }
];

const BACKEND_FRAMEWORKS = [
    { label: 'Express', value: 'express', description: 'npm run dev or npm start' },
    { label: 'NestJS', value: 'nestjs', description: 'npm run start:dev' },
    { label: 'Django', value: 'django', description: 'python manage.py runserver' },
    { label: 'Flask', value: 'flask', description: 'flask run' },
    { label: 'FastAPI', value: 'fastapi', description: 'uvicorn main:app --reload' },
    { label: 'Spring Boot', value: 'spring-boot', description: './mvnw spring-boot:run' },
    { label: 'Custom Command', value: 'custom', description: 'Specify your own command' }
];

export async function configureProject(configProvider: ConfigurationProvider): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Please open a workspace folder first.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Step 1: Select Frontend Folder
    vscode.window.showInformationMessage('Step 1/4: Select your Frontend folder');

    const frontendUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: vscode.Uri.file(workspaceRoot),
        openLabel: 'Select Frontend Folder',
        title: 'Select Frontend Folder'
    });

    if (!frontendUri || frontendUri.length === 0) {
        vscode.window.showWarningMessage('Configuration cancelled: No frontend folder selected.');
        return;
    }

    const frontendPath = path.relative(workspaceRoot, frontendUri[0].fsPath) || '.';
    await configProvider.setFrontendPath(frontendPath);

    // Step 2: Select Frontend Framework
    vscode.window.showInformationMessage('Step 2/4: Select your Frontend framework');

    const frontendFramework = await vscode.window.showQuickPick(FRONTEND_FRAMEWORKS, {
        placeHolder: 'Select the frontend framework',
        title: 'Frontend Framework'
    });

    if (!frontendFramework) {
        vscode.window.showWarningMessage('Configuration cancelled: No frontend framework selected.');
        return;
    }

    await configProvider.setFrontendFramework(frontendFramework.value);

    // If custom, ask for command
    if (frontendFramework.value === 'custom') {
        const customCmd = await vscode.window.showInputBox({
            prompt: 'Enter the custom start command for frontend',
            placeHolder: 'e.g., npm run dev',
            title: 'Custom Frontend Command'
        });
        if (customCmd) {
            await configProvider.setFrontendCustomCommand(customCmd);
        }
    }

    // Step 3: Select Backend Folder
    vscode.window.showInformationMessage('Step 3/4: Select your Backend folder');

    const backendUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: vscode.Uri.file(workspaceRoot),
        openLabel: 'Select Backend Folder',
        title: 'Select Backend Folder'
    });

    if (!backendUri || backendUri.length === 0) {
        vscode.window.showWarningMessage('Configuration cancelled: No backend folder selected.');
        return;
    }

    const backendPath = path.relative(workspaceRoot, backendUri[0].fsPath) || '.';
    await configProvider.setBackendPath(backendPath);

    // Step 4: Select Backend Framework
    vscode.window.showInformationMessage('Step 4/4: Select your Backend framework');

    const backendFramework = await vscode.window.showQuickPick(BACKEND_FRAMEWORKS, {
        placeHolder: 'Select the backend framework',
        title: 'Backend Framework'
    });

    if (!backendFramework) {
        vscode.window.showWarningMessage('Configuration cancelled: No backend framework selected.');
        return;
    }

    await configProvider.setBackendFramework(backendFramework.value);

    // If custom, ask for command
    if (backendFramework.value === 'custom') {
        const customCmd = await vscode.window.showInputBox({
            prompt: 'Enter the custom start command for backend',
            placeHolder: 'e.g., npm run dev',
            title: 'Custom Backend Command'
        });
        if (customCmd) {
            await configProvider.setBackendCustomCommand(customCmd);
        }
    }

    // Show success message
    vscode.window.showInformationMessage(
        `✅ Configuration saved!\n` +
        `Frontend: ${frontendPath} (${frontendFramework.label})\n` +
        `Backend: ${backendPath} (${backendFramework.label})`
    );
}
