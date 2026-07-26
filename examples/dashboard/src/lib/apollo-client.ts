import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

/**
 * Default timeout (ms) for GraphQL requests to the indexer.
 * If the RPC provider / indexer does not respond within this window the
 * fetch is aborted so the Apollo loading state is always cleared — fixes
 * the infinite-spinner bug (#158) where a timed-out request left the
 * Profile Page stuck in a permanent loading state.
 */
const REQUEST_TIMEOUT_MS =
  Number(import.meta.env.VITE_GRAPHQL_TIMEOUT_MS) || 15_000;

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'https://indexer.streamfi.io/graphql',
  /**
   * Attach a per-request AbortController so every in-flight fetch is
   * cancelled after REQUEST_TIMEOUT_MS. Apollo surfaces the resulting
   * AbortError as a network error, which sets `error` and clears `loading`
   * on the query, preventing the infinite-spinner scenario.
   */
  fetch: (uri, options) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    return fetch(uri, { ...options, signal: controller.signal }).finally(() =>
      clearTimeout(timeoutId),
    );
  },
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          streams: {
            // Key cache entries by sender + recipient + walletAddress so that
            // switching networks (different walletAddress) writes to a
            // separate cache slot rather than appending to the old one.
            // Fixes #156: stale data was shown after a network switch because
            // the old merge policy unconditionally appended incoming results
            // onto whatever was already cached, producing a mix of data from
            // the previous and current networks.
            keyArgs: ['walletAddress', 'sender', 'recipient'],
            // Always replace — the query already supplies ordering and limit,
            // so a full replacement is correct.  Infinite-scroll / cursor
            // pagination should be handled by separate keyArgs entries or a
            // dedicated field policy; unconditional appending here was the
            // source of the stale-data bug.
            merge(_existing, incoming) {
              return incoming;
            },
          },
          dashboardStats: {
            // Always replace with fresh server data
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      // Ensure we always get fresh data from the server after a mutation
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
    },
  },
});
