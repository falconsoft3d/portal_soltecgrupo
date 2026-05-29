import { NextRequest } from 'next/server';
import { odooProxy } from '../_proxy';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { current_password, new_password, confirm_password } = await req.json();
  return odooProxy(
    '/portal/soltec/change-password',
    { current_password, new_password, confirm_password },
    token,
  );
}
