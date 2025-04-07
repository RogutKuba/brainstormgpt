/**
 * Gets the value of a cookie by its name
 * @param name The name of the cookie to retrieve
 * @returns The cookie value if found, undefined otherwise
 */
export function getCookie(name: string): string | undefined {
  console.log('all-cookies  ', document.cookie);
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');

    console.log(cookieName, cookieValue);

    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }

  return undefined;
}
