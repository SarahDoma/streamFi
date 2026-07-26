import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'https://indexer.streamfi.io/graphql',
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          streams: {
            // Merge paginated stream results into a single cache entry
            keyArgs: ['sender', 'recipient'],
            merge(existing = { streams: [] }, incoming) {
              return {
                ...incoming,
                streams: [...existing.streams, ...incoming.streams],
              };
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
