# Insights VS Code Extension Playground

This is a playground to test Insights integration within a VS Code extension's webview.

## How to run

1.  Open this directory (`packages/browser/playground/vscode-extension`) in a separate VS Code window.
2.  Open a terminal and run `pnpm install`.
3.  Press `F5` to open a new **Extension Development Host** window.
4.  In the new window, open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and search for "Start Insights Playground".
5.  Run the command to open the webview.
6.  You can interact with the input and button to send events to Insights.

## Configuration

### Running with a local @hanzo/insights build

By default, the playground is configured to use a local build of `@hanzo/insights`. In `src/extension.js`, the `runningLocally` constant is set to `true`. This will load `array.full.js` from the `packages/browser/dist` directory.

To use the production snippet from the Insights CDN, you will need to set `runningLocally` to `false`.

### Environment Variables

The Insights project key and API host are loaded from a `.env` file in the root of the `@hanzo/insights` repository.

1.  If you don't already have one, create a `.env` file at the root of the `@hanzo/insights` project.
2.  Add your Insights Project Key to the `.env` file:
    ```
    INSIGHTS_PROJECT_API_KEY=<your-project-key>
    INSIGHTS_API_HOST=<your-api-host>
    ```
    If `INSIGHTS_API_HOST` is not set, it will default to `http://localhost:8010`.
