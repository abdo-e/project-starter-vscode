import * as fs from 'fs';
import * as path from 'path';

export class EnvManager {
    /**
     * Reads a .env file and parses it into a key-value object.
     */
    public static readEnv(filePath: string): Record<string, string> {
        if (!fs.existsSync(filePath)) {
            return {};
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const env: Record<string, string> = {};

        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });

        return env;
    }

    /**
     * Writes a key-value object to a .env file.
     */
    public static writeEnv(filePath: string, env: Record<string, string>): void {
        const content = Object.entries(env)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        fs.writeFileSync(filePath, content, 'utf-8');
    }

    /**
     * Merges new values into an existing .env file.
     */
    public static updateEnv(filePath: string, newValues: Record<string, string>): void {
        const currentEnv = this.readEnv(filePath);
        const mergedEnv = { ...currentEnv, ...newValues };
        this.writeEnv(filePath, mergedEnv);
    }
}
