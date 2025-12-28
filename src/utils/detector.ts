import * as fs from 'fs';
import * as path from 'path';

export interface DetectionResult {
    framework: string;
    confidence: number;
}

export class Detector {
    private static readonly FRONTEND_MARKERS = [
        { framework: 'react-vite', files: ['package.json'], pattern: /"vite"/, extra: /"react"/ },
        { framework: 'react-cra', files: ['package.json'], pattern: /"react-scripts"/ },
        { framework: 'vue', files: ['package.json'], pattern: /"vue"/ },
        { framework: 'angular', files: ['angular.json', 'package.json'], pattern: /"@angular\/core"/ },
        { framework: 'nextjs', files: ['package.json'], pattern: /"next"/ },
        { framework: 'nuxt', files: ['package.json'], pattern: /"nuxt"/ },
        { framework: 'svelte', files: ['package.json'], pattern: /"svelte"/ },
    ];

    private static readonly BACKEND_MARKERS = [
        { framework: 'express', files: ['package.json'], pattern: /"express"/ },
        { framework: 'nestjs', files: ['package.json'], pattern: /"@nestjs\/core"/ },
        { framework: 'django', files: ['manage.py'], pattern: /django/i },
        { framework: 'flask', files: ['requirements.txt', 'app.py'], pattern: /flask/i },
        { framework: 'fastapi', files: ['requirements.txt', 'main.py'], pattern: /fastapi/i },
        { framework: 'spring-boot', files: ['pom.xml', 'build.gradle'], pattern: /spring-boot/i },
    ];

    public static async detectFrontend(folderPath: string): Promise<string | null> {
        return this.detect(folderPath, this.FRONTEND_MARKERS);
    }

    public static async detectBackend(folderPath: string): Promise<string | null> {
        return this.detect(folderPath, this.BACKEND_MARKERS);
    }

    private static async detect(folderPath: string, markers: any[]): Promise<string | null> {
        if (!fs.existsSync(folderPath)) {
            return null;
        }

        for (const marker of markers) {
            for (const file of marker.files) {
                const filePath = path.join(folderPath, file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (marker.pattern.test(content)) {
                        if (marker.extra) {
                            if (marker.extra.test(content)) {
                                return marker.framework;
                            }
                        } else {
                            return marker.framework;
                        }
                    }
                }
            }
        }

        return null;
    }

    public static recommendScript(folderPath: string): string | undefined {
        const pkgPath = path.join(folderPath, 'package.json');
        if (!fs.existsSync(pkgPath)) return undefined;

        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const scripts = pkg.scripts || {};

            // Priority order for start scripts
            const candidates = ['dev', 'start', 'serve', 'watch'];
            for (const cand of candidates) {
                if (scripts[cand]) {
                    return `npm run ${cand}`;
                }
            }
        } catch (e) {
            return undefined;
        }

        return undefined;
    }
}
