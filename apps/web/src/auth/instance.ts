import { authConfig } from './config.ts';
import { createAuth } from './session.ts';

export const auth = createAuth(authConfig());
void auth.start();
