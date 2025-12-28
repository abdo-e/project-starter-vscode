import * as fs from 'fs';
import * as path from 'path';

export class DockerUtils {
    /**
     * Checks if a folder contains a Dockerfile.
     */
    public static async hasDockerfile(folderPath: string): Promise<boolean> {
        return fs.existsSync(path.join(folderPath, 'Dockerfile'));
    }

    /**
     * Checks if a folder contains a docker-compose.yml or docker-compose.yaml.
     */
    public static async hasDockerCompose(folderPath: string): Promise<boolean> {
        return fs.existsSync(path.join(folderPath, 'docker-compose.yml')) ||
            fs.existsSync(path.join(folderPath, 'docker-compose.yaml'));
    }

    /**
     * Returns the appropriate Docker start command for a folder.
     */
    public static async getDockerCommand(folderPath: string): Promise<string | null> {
        if (await this.hasDockerCompose(folderPath)) {
            return 'docker-compose up';
        } else if (await this.hasDockerfile(folderPath)) {
            const imageName = path.basename(folderPath).toLowerCase().replace(/[^a-z0-9]/g, '-');
            return `docker build -t ${imageName} . && docker run -p 8080:8080 ${imageName}`;
        }
        return null;
    }
}
