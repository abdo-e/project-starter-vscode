import * as fs from 'fs';
import * as path from 'path';

export class DependencyUtils {
    /**
     * Checks if common dependency markers are missing for a given framework.
     */
    public static async checkDependencies(folderPath: string, framework: string): Promise<boolean> {
        if (!fs.existsSync(folderPath)) {
            return true; // Folder doesn't exist, can't check
        }

        const markers: Record<string, string[]> = {
            'react-vite': ['node_modules'],
            'react-cra': ['node_modules'],
            'vue': ['node_modules'],
            'angular': ['node_modules'],
            'nextjs': ['node_modules'],
            'nuxt': ['node_modules'],
            'svelte': ['node_modules'],
            'express': ['node_modules'],
            'nestjs': ['node_modules'],
            'django': ['venv', '.venv'], // Common venv folders
            'flask': ['venv', '.venv'],
            'fastapi': ['venv', '.venv'],
            'spring-boot': ['target'] // Maven build folder
        };

        const frameworkMarkers = markers[framework] || ['node_modules'];

        // If it's a python framework, we should also check for requirements.txt or pyproject.toml
        // but the markers are what we're looking for to be *present*.

        for (const marker of frameworkMarkers) {
            if (fs.existsSync(path.join(folderPath, marker))) {
                return true; // At least one marker found
            }
        }

        // Special case for Java/Spring Boot: might not have target but might have pom.xml
        if (framework === 'spring-boot' && fs.existsSync(path.join(folderPath, 'pom.xml'))) {
            // If pom.xml exists but target doesn't, it might just need a build, 
            // but we'll consider it "not installed" if target is missing for simplicity in this check
            // or we can allow it if pom.xml exists. Let's be more lenient.
            return false;
        }

        // Special check for Python: if requirements.txt exists but no venv, it's missing
        if (['django', 'flask', 'fastapi'].includes(framework) &&
            fs.existsSync(path.join(folderPath, 'requirements.txt'))) {
            return false;
        }

        // Default for JS projects: if package.json exists but no node_modules
        if (fs.existsSync(path.join(folderPath, 'package.json')) &&
            !fs.existsSync(path.join(folderPath, 'node_modules'))) {
            return false;
        }

        return true;
    }

    /**
     * Returns the command to install dependencies for a given framework.
     */
    public static getInstallCommand(framework: string): string {
        const commands: Record<string, string> = {
            'react-vite': 'npm install',
            'react-cra': 'npm install',
            'vue': 'npm install',
            'angular': 'npm install',
            'nextjs': 'npm install',
            'nuxt': 'npm install',
            'svelte': 'npm install',
            'express': 'npm install',
            'nestjs': 'npm install',
            'django': 'python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt',
            'flask': 'python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt',
            'fastapi': 'python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt',
            'spring-boot': 'mvnw install'
        };

        // Note: Python commands above are Windows specific as per project requirement (Windows system)
        return commands[framework] || 'npm install';
    }
}
