import * as http from 'http';
import * as vscode from 'vscode';

export enum HealthStatus {
    Running = 'Running',
    Crashed = 'Crashed',
    Starting = 'Starting',
    None = 'None'
}

export class HealthChecker {
    private static instance: HealthChecker;
    private interval: NodeJS.Timeout | undefined;
    private statusCallback: (type: 'frontend' | 'backend', status: HealthStatus) => void;

    private constructor() {
        this.statusCallback = () => { };
    }

    public static getInstance(): HealthChecker {
        if (!HealthChecker.instance) {
            HealthChecker.instance = new HealthChecker();
        }
        return HealthChecker.instance;
    }

    public onStatusChange(callback: (type: 'frontend' | 'backend', status: HealthStatus) => void) {
        this.statusCallback = callback;
    }

    public startMonitoring(frontendPort: number, backendPort: number) {
        this.stopMonitoring();

        // Initial check
        this.check(frontendPort, 'frontend');
        this.check(backendPort, 'backend');

        this.interval = setInterval(() => {
            this.check(frontendPort, 'frontend');
            this.check(backendPort, 'backend');
        }, 5000);
    }

    public stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }

    private async check(port: number, type: 'frontend' | 'backend') {
        const isResponding = await this.ping(port);
        this.statusCallback(type, isResponding ? HealthStatus.Running : HealthStatus.Crashed);
    }

    private ping(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const req = http.get(`http://localhost:${port}`, (res) => {
                // If it responds with anything, it's considered alive
                resolve(true);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
}
