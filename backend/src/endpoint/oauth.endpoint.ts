import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import {
  OAuth2RequestError,
  generateState,
  generateCodeVerifier,
} from 'arctic';
import { getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { GoogleOauthService, GoogleUser } from '../service/GoogleOauth.service';
import { decodeIdToken } from 'arctic';

// LOGIN ROUTE
const loginRoute = createRoute({
  method: 'get',
  path: '/login',
  responses: {
    302: {
      description: 'Returns google login redirect',
    },
    ...ErrorResponses,
  },
});

// CALLBACK ROUTE
const callbackRoute = createRoute({
  method: 'get',
  path: '/callback',
  request: {
    query: z.object({
      code: z.string().openapi({
        description: 'Authorization code from google',
      }),
      state: z.string().openapi({
        description: 'State from google',
      }),
    }),
  },
  responses: {
    302: {
      description: 'Redirects to dashboard',
    },
    ...ErrorResponses,
  },
});

export const googleAuthRouter = new OpenAPIHono<AppContext>()
  .openapi(loginRoute, async (ctx) => {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    const googleClient = GoogleOauthService.getGoogleClient(ctx);
    const url = googleClient.createAuthorizationURL(state, codeVerifier, [
      'email',
      'profile',
    ]);

    // store state verifier as cookieSite: "lax"
    setCookie(ctx, 'state', state, {
      path: '/',
      httpOnly: true,
      secure: ctx.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 min
      sameSite: 'Lax', // Allow cookies in redirects
    });

    // store code verifier as cookie
    setCookie(ctx, 'code_verifier', codeVerifier, {
      path: '/',
      httpOnly: true,
      secure: ctx.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 min
      sameSite: 'Lax', // Allow cookies in redirects
    });

    return ctx.redirect(url.toString(), 302);
  })
  .openapi(callbackRoute, async (ctx) => {
    const { code, state } = ctx.req.valid('query');

    const storedState = getCookie(ctx, 'state');
    const storedCodeVerifier = getCookie(ctx, 'code_verifier');

    if (!code || !storedState || !storedCodeVerifier || state !== storedState) {
      // 400
      throw new HTTPException(400, { message: 'Invalid request' });
    }

    try {
      const googleClient = GoogleOauthService.getGoogleClient(ctx);
      const tokens = await googleClient.validateAuthorizationCode(
        code,
        storedCodeVerifier
      );
      const claims = decodeIdToken(tokens.idToken()) as GoogleUser;

      const redirectUrl = await GoogleOauthService.loginGoogleUser({
        googleUser: claims,
        ctx,
      });

      return ctx.redirect(redirectUrl, 302);
    } catch (e) {
      console.error('OAuth Error!', e);

      throw new HTTPException(400, {
        message: 'OAuth Error!: Failed to authenticate',
      });
    }
  });
