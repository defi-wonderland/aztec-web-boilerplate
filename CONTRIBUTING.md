# Contributing to Bridge and Seek

We welcome contributions to Bridge and Seek! Whether you're fixing bugs, improving documentation, or proposing new features, your help is appreciated.

## Getting Started

1. **Fork the repository** and clone it locally
2. **Set up your development environment** following the Quick Start guide in the README
3. **Create a feature branch** from `dev` branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Guidelines

### Code Style
- Follow the existing code patterns and conventions in the codebase
- Use TypeScript for all new code
- Run `yarn lint` before committing to ensure code formatting
- Keep components small and focused on a single responsibility

### Commit Messages
Follow conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, semicolons, etc.)
- `refactor:` Code refactoring without changing functionality
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example: `feat: add private balance display to bridge UI`

### Testing
- Write tests for new features when applicable
- Ensure all existing tests pass with `yarn test`
- Test your changes locally with both Aztec sandbox and testnet

## Pull Request Process

1. **Update your branch** with the latest `dev` branch changes
2. **Test thoroughly** - ensure your changes work as expected
3. **Create a Pull Request** with:
   - Clear title describing the change
   - Description of what was changed and why
   - Any relevant issue numbers
   - Screenshots for UI changes
4. **Address review feedback** promptly
5. **Maintain backwards compatibility** when possible

## Reporting Issues

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node version)
- Any relevant error messages or logs

## Security

- Never commit sensitive information (private keys, secrets)
- Report security vulnerabilities privately to the maintainers
- Follow secure coding practices for handling user data

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.