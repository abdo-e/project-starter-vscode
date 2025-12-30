import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class TailwindUtils {
    public static async setup(projectRoot: string, framework: string): Promise<void> {
        const terminal = vscode.window.createTerminal('🖌️ Tailwind Setup');
        terminal.show();
        terminal.sendText(`cd "${projectRoot}"`);

        let installCmd = '';
        if (framework === 'react-vite' || framework === 'nextjs' || framework === 'custom') {
            installCmd = 'npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p';
        }

        if (installCmd) {
            terminal.sendText(installCmd);

            // Wait a bit for the config files to be created by the init command
            // or we could manually create them if they don't appear.
            // For now, let's just provide the content and instructions.
            this.updateTailwindConfig(projectRoot, framework);
            this.updateCssFiles(projectRoot);
        }
    }

    private static updateTailwindConfig(projectRoot: string, framework: string): void {
        const configPath = path.join(projectRoot, 'tailwind.config.js');
        const content = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
        // We write it after a delay in the terminal, but here we can just ensure it exists with correct content
        setTimeout(() => {
            if (fs.existsSync(projectRoot)) {
                fs.writeFileSync(configPath, content);
            }
        }, 5000);
    }

    private static updateCssFiles(projectRoot: string): void {
        const cssDirectives = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
        const srcPath = path.join(projectRoot, 'src');
        if (fs.existsSync(srcPath)) {
            const indexCss = path.join(srcPath, 'index.css');
            const appCss = path.join(srcPath, 'App.css');

            if (fs.existsSync(indexCss)) {
                const current = fs.readFileSync(indexCss, 'utf8');
                if (!current.includes('@tailwind')) {
                    fs.writeFileSync(indexCss, cssDirectives + '\n' + current);
                }
            } else if (fs.existsSync(appCss)) {
                const current = fs.readFileSync(appCss, 'utf8');
                if (!current.includes('@tailwind')) {
                    fs.writeFileSync(appCss, cssDirectives + '\n' + current);
                }
            } else {
                fs.writeFileSync(path.join(srcPath, 'tailwind.css'), cssDirectives);
            }
        }
    }
}
