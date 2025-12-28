import * as vscode from 'vscode';

export class AIHelper {
    /**
     * Analyzes an error string and returns a helpful explanation and fix.
     * Note: This is a placeholder for a real AI integration (e.g., Gemini).
     */
    public static async analyzeError(errorText: string): Promise<string> {
        // In a real implementation, you would call an AI API like Gemini here.
        // For now, we'll simulate a helpful response.

        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network latency

        if (errorText.includes('EADDRINUSE')) {
            return `### 🔍 AI Analysis: Port Conflict
**Problem:** The port your server is trying to use is already occupied by another process.
**Fix:** 
1. Kill the process using the port (Project Starter usually handles this).
2. Change the port in your project configuration.
3. Use the 'Port Conflict Detection' feature in the Dashboard.`;
        }

        if (errorText.includes('module not found') || errorText.includes('cannot find module')) {
            return `### 🔍 AI Analysis: Missing Dependency
**Problem:** A required Node.js module is missing.
**Fix:** Run \`npm install\` or \`yarn install\` in the project directory. You can also use the 'Dependency Auto-Install' feature.`;
        }

        return `### 🔍 AI Analysis
**Error Captured:** 
\`\`\`
${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}
\`\`\`

**Suggestion:** This looks like a general execution error. Please check if:
1. All environment variables are set correctly.
2. The database is running (if applicable).
3. The specified start command is correct for your framework.`;
    }

    /**
     * Opens the AI analysis in a new markdown preview document.
     */
    public static async showAnalysis(analysis: string) {
        const doc = await vscode.workspace.openTextDocument({
            content: analysis,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    }
}
