```markdown
# COGNIFLOW-M Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill introduces the core development patterns and conventions used in the COGNIFLOW-M repository, a TypeScript React codebase. It covers file naming, import/export styles, commit message guidelines, and testing patterns. By following these practices, contributors can ensure consistency and maintainability throughout the project.

## Coding Conventions

### File Naming
- Use **snake_case** for all file names.
  - Example:  
    ```
    user_profile.tsx
    data_fetcher.ts
    ```

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { fetchData } from './data_fetcher';
    ```

### Export Style
- Both **named** and **default exports** are used.
  - Named export example:
    ```typescript
    export function processInput(input: string): string { ... }
    ```
  - Default export example:
    ```typescript
    const UserProfile = () => { ... };
    export default UserProfile;
    ```

### Commit Messages
- Follow **conventional commit** format.
- Use prefixes like `fix`.
- Keep messages concise (average length: ~83 characters).
  - Example:
    ```
    fix: resolve issue with data fetch on component mount
    ```

## Workflows

_No explicit workflows detected in the repository._

## Testing Patterns

- **Test Framework:** Unknown (not specified in the repository).
- **Test File Pattern:** All test files follow the `*.test.*` naming convention.
  - Example:
    ```
    user_profile.test.tsx
    data_fetcher.test.ts
    ```
- Place test files alongside the modules they test or in a dedicated `tests/` directory.

## Commands
| Command | Purpose |
|---------|---------|
| /conventions | Show coding conventions for COGNIFLOW-M |
| /test-patterns | Show test file naming and structure |
```