import { http, HttpResponse } from 'msw'

// Default happy-path handlers — override in individual tests with server.use()
export const handlers = [
  http.post('/api/render-jobs', () => {
    return HttpResponse.json({ id: 'test-render-job-id', status: 'QUEUED' }, { status: 201 })
  }),

  http.get('/api/render-jobs/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'COMPLETE',
      outputAssets: [],
    })
  }),
]
