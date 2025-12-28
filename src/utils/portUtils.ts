import * as net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class PortUtils {
    /**
     * Checks if a port is available on localhost.
     */
    public static async isPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    resolve(true); // Other errors might not mean the port is in use
                }
            });
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            server.listen(port, '127.0.0.1');
        });
    }

    /**
     * Tries to find which process is using the port and kill it.
     * Works mainly on Windows using netstat and taskkill.
     */
    public static async killProcessOnPort(port: number): Promise<boolean> {
        try {
            if (process.platform === 'win32') {
                // Find PID
                const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
                const lines = stdout.split('\n');

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5 && parts[1].endsWith(`:${port}`)) {
                        const pid = parts[4];
                        if (pid && pid !== '0') {
                            await execPromise(`taskkill /F /PID ${pid}`);
                            return true;
                        }
                    }
                }
            } else {
                // macOS/Linux
                await execPromise(`lsof -ti:${port} | xargs kill -9`);
                return true;
            }
        } catch (error) {
            console.error(`Failed to kill process on port ${port}:`, error);
        }
        return false;
    }

    /**
     * Extracts port from framework config or common defaults.
     */
    public static getPortForFramework(framework: string, type: 'frontend' | 'backend'): number {
        const defaults: Record<string, number> = {
            'react-vite': 5173,
            'react-cra': 3000,
            'vue': 8080,
            'angular': 4200,
            'nextjs': 3000,
            'nuxt': 3000,
            'svelte': 5173,
            'express': 3000,
            'nestjs': 3000,
            'django': 8000,
            'flask': 5000,
            'fastapi': 8000,
            'spring-boot': 8080
        };

        return defaults[framework] || (type === 'frontend' ? 3000 : 8080);
    }
}
