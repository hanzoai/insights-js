import { Insights } from 'insights-node';
/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	INSIGHTS_PROJECT_API_KEY: string;
	INSIGHTS_API_HOST: string;
	INSIGHTS_PERSONAL_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const insights = new Insights(env.INSIGHTS_PROJECT_API_KEY, {
			host: env.INSIGHTS_API_HOST,
			personalApiKey: env.INSIGHTS_PERSONAL_API_KEY,
			featureFlagsPollingInterval: 10000,
		});

		insights.capture({ distinctId: `user-${Date.now()}`, event: 'test event', properties: { test: 'test' } });

		await insights.flush();

		return new Response('Success!');
	},
};
