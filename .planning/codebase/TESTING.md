# Testing: Stock Management

**Mapped:** 2026-06-24
**Focus:** Test framework, structure, and coverage

## Test Status

**No tests exist.** The project has zero test files.

## Observations

- No test runner configured in `package.json`
- No test scripts defined
- No test directory or test files found
- No CI configuration present

## Recommendations

Introduce testing as part of the first phase:

1. **Test runner:** Vitest (lightweight, fast, compatible with Electron)
2. **Balance logic:** Unit tests for `getBalances()` — critical business logic
3. **Entry CRUD:** Unit tests for entry creation, deletion
4. **Data model validation:** Schema validation for entry objects
5. **API endpoints:** Integration tests for Express server endpoints

## Priority for Testing

| Area | Priority | Reason |
|------|----------|--------|
| Balance calculation | Critical | Core business logic, easy to get wrong |
| Entry CRUD operations | High | Data integrity |
| Search/filter logic | Medium | Affects user experience |
| API auth middleware | High | Security |
| PDF export | Low | Non-critical, hard to test |
| UI rendering | Low | Would benefit from E2E testing later |
