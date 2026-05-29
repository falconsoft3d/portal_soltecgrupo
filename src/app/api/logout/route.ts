import { NextRequest } from 'next/server';
import { odooProxy } from '../_proxy';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  return odooProxy('/portal/soltec/logout', {}, token);
}
