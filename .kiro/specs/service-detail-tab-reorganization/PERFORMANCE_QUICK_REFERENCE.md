# Performance Optimizations - Quick Reference Guide

## Quick Start

### 1. Using Memoized Components

All tab components and their sub-components are now memoized. No changes needed to use them - they work exactly the same but with better performance.

```typescript
import { OverviewTab } from '@/components/services/OverviewTab'
import { ConfigurationTab } from '@/components/services/ConfigurationTab'
import { DeploymentsTab } from '@/components/services/DeploymentsTab'

// Use as normal - memoization is automatic
<OverviewTab {...props} />
```

### 2. Using Lazy-Loaded Components

For code splitting benefits, use the lazy-loaded versions:

```typescript
import { 
  LazyOverviewTab, 
  LazyConfigurationTab, 
  LazyDeploymentsTab 
} from '@/components/services/LazyTabComponents'

// Replace in TabsContent
<TabsContent value="overview">
  <LazyOverviewTab {...overviewProps} />
</TabsContent>
```

### 3. Using Debounce Hooks

#### Debounce a Value
```typescript
import { useDebounce } from '@/hooks/useDebounce'

const [searchTerm, setSearchTerm] = useState('')
const debouncedSearchTerm = useDebounce(searchTerm, 500)

useEffect(() => {
  // Only runs 500ms after user stops typing
  fetchResults(debouncedSearchTerm)
}, [debouncedSearchTerm])
```

#### Debounce a Callback
```typescript
import { useDebouncedCallback } from '@/hooks/useDebounce'

const handleSearch = useDebouncedCallback((term: string) => {
  fetchResults(term)
}, 500)

<input onChange={(e) => handleSearch(e.target.value)} />
```

## When to Use What

### React.memo
✅ **Use when:**
- Component has expensive render logic
- Component receives same props frequently
- Component is a leaf in the component tree

❌ **Don't use when:**
- Component always receives different props
- Component is very simple (< 10 lines)
- Props include functions that change every render

### useCallback
✅ **Use when:**
- Function is passed to memoized child component
- Function is used in useEffect dependencies
- Function is expensive to create

❌ **Don't use when:**
- Function is not passed as prop
- Function is very simple
- Over-optimizing (premature optimization)

### useMemo
✅ **Use when:**
- Computation is expensive
- Value is passed to memoized component
- Value is used in multiple places

❌ **Don't use when:**
- Computation is trivial
- Value is only used once
- Over-optimizing (premature optimization)

### Debouncing
✅ **Use when:**
- Input triggers expensive operations
- Input triggers API calls
- Input triggers complex validation

❌ **Don't use when:**
- Immediate feedback is required
- Operation is very fast
- User expects instant response

### Code Splitting
✅ **Use when:**
- Component is large (> 50KB)
- Component is not needed initially
- Component is tab/modal content

❌ **Don't use when:**
- Component is small
- Component is needed immediately
- Component is critical for initial render

## Common Patterns

### Pattern 1: Memoized Component with Callbacks
```typescript
export const MyComponent = memo(function MyComponent({ onUpdate, items }) {
  const handleAdd = useCallback(() => {
    onUpdate([...items, newItem])
  }, [items, onUpdate])
  
  return <button onClick={handleAdd}>Add</button>
})
```

### Pattern 2: Expensive Computation
```typescript
export const MyComponent = memo(function MyComponent({ data }) {
  const processedData = useMemo(() => {
    return expensiveProcessing(data)
  }, [data])
  
  return <div>{processedData}</div>
})
```

### Pattern 3: Debounced Search
```typescript
export function SearchComponent() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  
  useEffect(() => {
    if (debouncedQuery) {
      fetchResults(debouncedQuery)
    }
  }, [debouncedQuery])
  
  return <input value={query} onChange={e => setQuery(e.target.value)} />
}
```

### Pattern 4: Lazy Loading
```typescript
const LazyComponent = dynamic(
  () => import('./HeavyComponent'),
  { 
    loading: () => <Spinner />,
    ssr: false 
  }
)
```

## Troubleshooting

### Component Not Re-rendering
**Problem:** Memoized component doesn't update when it should

**Solution:** Check if props are properly compared. Objects and arrays need stable references:
```typescript
// ❌ Bad - creates new array every render
<MyComponent items={data.filter(x => x.active)} />

// ✅ Good - memoize the filtered array
const activeItems = useMemo(() => data.filter(x => x.active), [data])
<MyComponent items={activeItems} />
```

### Callback Causing Re-renders
**Problem:** useCallback not preventing re-renders

**Solution:** Ensure all dependencies are stable:
```typescript
// ❌ Bad - object in dependencies
const handleClick = useCallback(() => {
  doSomething(config)
}, [config]) // config is a new object every render

// ✅ Good - destructure stable values
const { value } = config
const handleClick = useCallback(() => {
  doSomething({ value })
}, [value])
```

### Debounce Not Working
**Problem:** Debounced value updates immediately

**Solution:** Make sure you're using the debounced value, not the original:
```typescript
// ❌ Bad - using original value
const debouncedValue = useDebounce(value, 500)
useEffect(() => {
  fetch(value) // Wrong!
}, [value])

// ✅ Good - using debounced value
const debouncedValue = useDebounce(value, 500)
useEffect(() => {
  fetch(debouncedValue) // Correct!
}, [debouncedValue])
```

### Lazy Component Flashing
**Problem:** Loading fallback flashes briefly

**Solution:** Add minimum display time or use Suspense:
```typescript
const LazyComponent = dynamic(
  () => import('./Component'),
  { 
    loading: () => <Spinner />,
    ssr: false,
    // Add delay to prevent flash
    loading: () => <div style={{ minHeight: '200px' }}><Spinner /></div>
  }
)
```

## Performance Checklist

Before committing changes, verify:

- [ ] Components with expensive renders are memoized
- [ ] Callbacks passed to memoized components use useCallback
- [ ] Expensive computations use useMemo
- [ ] Input fields that trigger expensive operations are debounced
- [ ] Large components not needed initially are lazy-loaded
- [ ] All dependencies in hooks are correct
- [ ] No unnecessary re-renders (check with React DevTools Profiler)
- [ ] TypeScript compilation passes
- [ ] No linting errors

## Tools

### React DevTools Profiler
1. Open React DevTools
2. Go to Profiler tab
3. Click record
4. Interact with the component
5. Stop recording
6. Analyze render times and re-renders

### Bundle Analyzer
```bash
# Analyze bundle size
npm run build
npm run analyze
```

### Performance Monitoring
```typescript
// Add to component
useEffect(() => {
  const start = performance.now()
  // ... expensive operation
  const end = performance.now()
  console.log(`Operation took ${end - start}ms`)
}, [])
```

## Resources

- [React.memo Documentation](https://react.dev/reference/react/memo)
- [useCallback Hook](https://react.dev/reference/react/useCallback)
- [useMemo Hook](https://react.dev/reference/react/useMemo)
- [Next.js Dynamic Imports](https://nextjs.org/docs/advanced-features/dynamic-import)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)

## Need Help?

- Check `PERFORMANCE_OPTIMIZATIONS.md` for detailed documentation
- Review `PERFORMANCE_IMPLEMENTATION_SUMMARY.md` for implementation details
- Use React DevTools Profiler to identify performance issues
- Ask team members for code review
