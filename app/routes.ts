import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	index('routes/home.tsx'),
	route('review/:sessionId', 'routes/review.tsx'),
	route('api/repos/scan', 'routes/api.repos.scan.ts'),
	route('api/comments', 'routes/api.comments.ts'),
	route('api/sessions', 'routes/api.sessions.ts'),
	route('api/send', 'routes/api.send.ts'),
	route('api/process', 'routes/api.process.ts'),
] satisfies RouteConfig;
