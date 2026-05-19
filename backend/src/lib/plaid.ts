import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

/** Create a fresh PlaidApi client per-call so env vars are always current. */
export function getPlaidClient(): PlaidApi {
  const env = (process.env.PLAID_ENV ?? 'sandbox') as keyof typeof PlaidEnvironments;
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ?? '',
          'PLAID-SECRET': process.env.PLAID_SECRET ?? '',
        },
      },
    }),
  );
}
