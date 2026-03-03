import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw/server'
import { afterAll, afterEach, beforeAll } from 'vitest'

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers between tests to avoid state leakage
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
