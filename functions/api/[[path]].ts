import { handle } from '../../server/api';
export const onRequest: PagesFunction<import('../../server/api').Env> = context => handle(context.request, context.env);
