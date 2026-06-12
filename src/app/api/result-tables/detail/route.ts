import { NextRequest } from 'next/server';
import { odooProxy } from '../../_proxy';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const body = await req.json().catch(() => ({}));
  return odooProxy('/portal/soltec/result-tables/detail', body, token);
}
