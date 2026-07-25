# Dashboard Example - CSS Modules Fix

This example demonstrates proper CSS modules configuration for production builds with working flexbox layouts.

## The Problem

CSS modules were not being applied correctly in production builds, causing:
- Broken flexbox layouts
- Missing styles
- Inconsistent class name generation

## The Solution

This fix addresses the issue by:

1. **Proper Vite Configuration** (`vite.config.ts`):
   - Explicit CSS modules configuration
   - Consistent class name generation with `generateScopedName`
   - Camel case convention for easier TypeScript usage
   - Source maps for debugging

2. **CSS Modules Best Practices** (`Dashboard.module.css`):
   - Proper flexbox layout structure
   - Responsive design with media queries
   - Clean, maintainable CSS organization

3. **TypeScript Integration**:
   - Type definitions for CSS modules
   - Proper import handling

## Running the Example

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Key Features

- **Responsive Flexbox Layout**: Works correctly in both development and production
- **CSS Modules**: Scoped styles that don't leak globally
- **Production-Ready**: Optimized build configuration
- **TypeScript Support**: Full type safety for component props and styles

## File Structure

```
examples/dashboard/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx          # Main dashboard component
│   │   └── Dashboard.module.css   # CSS modules styles
│   ├── App.tsx                    # Root component
│   └── main.tsx                   # Entry point
├── index.html                     # HTML template
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── vite.config.ts                 # Vite configuration
```

## Configuration Details

### Vite CSS Modules Config

```typescript
css: {
  modules: {
    localsConvention: 'camelCase',
    generateScopedName: '[name]__[local]___[hash:base64:5]',
  },
  devSourcemap: true,
},
```

### CSS Modules Usage

```tsx
import styles from './Dashboard.module.css';

// Access styles as camelCase properties
<div className={styles.dashboard}>
  <header className={styles.header}>
```

## Production Build Verification

1. Run `npm run build`
2. Open `dist/index.html` in browser
3. Verify flexbox layouts are correct
4. Check that CSS modules are properly scoped
5. Confirm no global style leaks
