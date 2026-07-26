import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const httpLink = new HttpLink({
  uri:
    import.meta.env.VITE_GRAPHQL_ENDPOINT ||
    "https://indexer.streamfi.io/graphql",
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          streams: {
            // keyArgs controls what makes a distinct cache entry.
            // Including 'walletAddress', 'limit', and 'orderBy' ensures that
            // different query shapes are cached separately and that a refetch
            // with the same args fully replaces the cached list rather than
            // appending to it (the previous merge accumulated stale entries).
            keyArgs: ["walletAddress", "limit", "orderBy"],
            // Replace the entire list on every incoming response so that
            // mutations followed by refetchQueries always surface fresh data.
            merge(_existing, incoming) {
              return incoming;
            },
          },
          dashboardStats: {
            // Always replace with fresh server data.
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
      // cache-and-network renders cached data immediately while the network
      // request completes, then updates the UI with the fresh response.
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  },
});
