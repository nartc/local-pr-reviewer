import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	index('routes/home.tsx'),
	route('review/:sessionId', 'routes/review.tsx'),
	route('api/repos/scan', 'routes/api.repos.scan.ts'),
	route('api/comments', 'routes/api.comments.ts'),
	route('api/send', 'routes/api.send.ts'),
	route('api/process', 'routes/api.process.ts'),
	route('api/mcp/status', 'routes/api.mcp.status.ts'),
	route('api/health', 'routes/api.health.ts'),
	route('api/session', 'routes/api.session.ts'),
] satisfies RouteConfig;
