type FrameworkType = 'frontend' | 'backend';

interface FrameworkCommand {
    [key: string]: string;
}

// Commands that work in PowerShell (Windows)
const FRONTEND_COMMANDS: FrameworkCommand = {
    'react-vite': 'npm run dev',
    'react-cra': 'npm start',
    'vue': 'npm run dev',
    'angular': 'npm start',
    'nextjs': 'npm run dev',
    'nuxt': 'npm run dev',
    'svelte': 'npm run dev'
};

const BACKEND_COMMANDS: FrameworkCommand = {
    'express': 'npm run dev',
    'nestjs': 'npm run start:dev',
    'django': 'python manage.py runserver',
    'flask': 'python -m flask run',
    'fastapi': 'python -m uvicorn main:app --reload',
    'spring-boot': 'mvnw spring-boot:run'
};

export function getStartCommand(
    framework: string,
    type: FrameworkType,
    customCommand?: string
): string {
    if (framework === 'custom' && customCommand) {
        return customCommand;
    }

    const commands = type === 'frontend' ? FRONTEND_COMMANDS : BACKEND_COMMANDS;
    return commands[framework] || 'npm start';
}

export function detectFramework(packageJsonPath: string): string | null {
    // This could be enhanced to read package.json and detect framework
    // For now, return null to let user select manually
    return null;
}
