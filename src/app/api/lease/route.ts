import { NextRequest, NextResponse } from 'next/server';
import {
	occupy,
	resetCluster,
	schedule,
	snapshot,
	storm
} from '@/lib/lease-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function ipOf(req: NextRequest) {
	return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET() {
	return NextResponse.json(await snapshot());
}

export async function POST(req: NextRequest) {
	const ip = ipOf(req);
	const body = (await req.json()) as {
		action?: string;
		slotId?: string;
		tenantId?: string;
		deviceId?: string;
		n?: number;
	};
	switch (body.action) {
		case 'occupy':
			return NextResponse.json(
				await occupy(body.slotId || '', body.tenantId || 'spark', ip)
			);
		case 'storm':
			return NextResponse.json(
				await storm(body.slotId || '', body.n ?? 160, ip)
			);
		case 'schedule':
			return NextResponse.json(await schedule(body.deviceId || ''));
		case 'reset':
			return NextResponse.json(await resetCluster());
		default:
			return NextResponse.json({ error: 'unknown action' }, { status: 400 });
	}
}
