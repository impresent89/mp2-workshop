# Repository Guidelines

## Project Structure & Module Organization

The repository is currently an empty workspace: no application source, tests, or assets are present yet. As the project takes shape, keep production code in a clearly named source directory (such as `src/`), tests in `tests/` or alongside the modules they cover, and static assets in `assets/` or the framework's conventional public directory. Group related code by feature and document any non-obvious top-level directories here.

## Build, Test, and Development Commands

No build system or local development commands are configured yet. When introducing a toolchain, add its dependency manifest and document reproducible commands here. Provide a local run command and focused and full test commands (for example, `npm run dev` and `npm test` for a Node project); use the commands actually defined by the project rather than assuming these examples apply.

## Coding Style & Naming Conventions

There is no language-specific style configuration yet. Follow the conventions of the chosen language and framework, use consistent formatting, and add formatter or linter configuration with the first implementation. Prefer descriptive names: `PascalCase` for types and components where conventional, and `camelCase` for functions and variables where conventional. Keep files focused and avoid adding dependencies without a clear need.

## Testing Guidelines

No testing framework or coverage requirement is configured. Add tests with new behavior and bug fixes, name them consistently with the selected test runner (for example, `*.test.ts`), and make the test command easy to run from the repository root. Document any required fixtures or environment setup.

## Commit & Pull Request Guidelines

Git history is not available in this workspace, so no established commit convention can be inferred. Use short, imperative commit subjects (for example, `Add input validation`) until the project establishes a convention. Pull requests should explain the change and its motivation, list relevant verification commands and results, link related issues when applicable, and include screenshots for user-visible changes.

## Security & Configuration

Keep credentials and machine-specific settings out of source control. Provide a documented example configuration file when needed, and validate required environment variables at startup.
