# Project Starter

A VS Code extension that simplifies full-stack development by allowing you to configure and start both frontend and backend servers with a single click.

## Features

- **🎯 Quick Configuration**: Select your frontend and backend folders with a simple dialog
- **🚀 One-Click Start**: Start both servers simultaneously from the status bar
- **🛑 Easy Stop**: Stop all running servers with one click
- **📋 Error Capture**: Quickly copy error messages from terminals
- **🔧 Framework Support**: Pre-configured commands for popular frameworks

## Supported Frameworks

### Frontend
- React (Vite & CRA)
- Vue
- Angular
- Next.js
- Nuxt
- Svelte
- Custom command

### Backend
- Express
- NestJS
- Django
- Flask
- FastAPI
- Spring Boot
- Custom command

## Usage

### Initial Configuration

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `Project Starter: Configure Project`
3. Select your frontend folder
4. Choose your frontend framework
5. Select your backend folder
6. Choose your backend framework

### Starting Servers

Click the **▶ Start Servers** button in the status bar, or:
1. Open Command Palette
2. Run `Project Starter: Start Servers`

### Stopping Servers

Click the **⏹ Stop Servers** button in the status bar, or:
1. Open Command Palette
2. Run `Project Starter: Stop Servers`

### Capturing Errors

When an error occurs in your terminal:
1. Select and copy the error text (`Ctrl+C`)
2. Click "Capture Error from Clipboard" when prompted, or
3. Run `Project Starter: Copy Last Error` to copy it again

## Configuration

You can also configure the extension manually in your workspace settings (`.vscode/settings.json`):

```json
{
  "projectStarter.frontend.path": "client",
  "projectStarter.frontend.framework": "react-vite",
  "projectStarter.backend.path": "server",
  "projectStarter.backend.framework": "express"
}
```

## Development

### Building the Extension

```bash
npm install
npm run compile
```

### Testing

Press `F5` in VS Code to launch the Extension Development Host.

## License

MIT
