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
import { WorkspaceService } from '../service/Workspace.service';

// LOGIN ROUTE
const loginRoute = createRoute({
  method: 'get',
  path: '/login',
  request: {
    query: z.object({
      prompt: z.string().optional().openapi({
        description: 'Prompt from login page',
      }),
    }),
  },
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

const USER_PROMPT_COOKIE_NAME = 'user_prompt';

export const googleAuthRouter = new OpenAPIHono<AppContext>()
  .openapi(loginRoute, async (ctx) => {
    const { prompt } = ctx.req.valid('query');
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    const googleClient = GoogleOauthService.getGoogleClient(ctx);
    const url = googleClient.createAuthorizationURL(state, codeVerifier, [
      'email',
      'profile',
    ]);

    if (prompt) {
      setCookie(ctx, USER_PROMPT_COOKIE_NAME, prompt, {
        path: '/',
        httpOnly: true,
        secure: ctx.env.NODE_ENV === 'production',
        maxAge: 60 * 10, // 10 min
        sameSite: 'Lax', // Allow cookies in redirects
      });
    }

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

    const userPrompt = getCookie(ctx, USER_PROMPT_COOKIE_NAME);

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

      if (userPrompt) {
        // create new user and workspace
        const workspace = await WorkspaceService.createWorkspace({
          ctx,
          name: userPrompt,
          prompt: userPrompt,
        });

        // redirect to workspace
        return ctx.redirect(`${redirectUrl}/workspace/${workspace.code}`, 302);
      }

      return ctx.redirect(redirectUrl, 302);
    } catch (e) {
      console.error('OAuth Error!', e);

      throw new HTTPException(400, {
        message: 'OAuth Error!: Failed to authenticate',
      });
    }
  });
