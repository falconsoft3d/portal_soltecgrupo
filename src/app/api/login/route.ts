import { NextRequest } from 'next/server';
import { odooProxy } from '../_proxy';

export async function POST(req: NextRequest) {
  const { login, password } = await req.json();
  return odooProxy('/portal/soltec/login', { login, password });
}
