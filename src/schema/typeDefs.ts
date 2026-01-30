export const typeDefs = /* GraphQL */ `
  type Query {
    health: Health!
    libraries: [Library!]!
    movies(libraryId: ID!, first: Int = 50, offset: Int = 0): [Movie!]!
    shows(libraryId: ID!, first: Int = 50, offset: Int = 0): [Show!]!
    seasons(showId: ID!): [Season!]!
    episodes(seasonId: ID!): [Episode!]!
    media(id: ID!): MediaItem
    search(query: String!): [MediaItem!]!
  }

  type Health {
    ok: Boolean!
    plexBaseUrl: String!
  }

  type Library {
    id: ID!
    title: String!
    type: String!
  }

  interface MediaItem {
    id: ID!
    title: String!
    year: Int
    summary: String
    thumb: String
    art: String
    viewCount: Int
  }

  type Movie implements MediaItem {
    id: ID!
    title: String!
    year: Int
    summary: String
    thumb: String
    art: String
    viewCount: Int
    duration: Int
    rating: Float
  }

  type Show implements MediaItem {
    id: ID!
    title: String!
    year: Int
    summary: String
    thumb: String
    art: String
    viewCount: Int
    childCount: Int
  }

  type Season implements MediaItem {
    id: ID!
    title: String!
    year: Int
    summary: String
    thumb: String
    art: String
    viewCount: Int
    index: Int
  }

  type Episode implements MediaItem {
    id: ID!
    title: String!
    year: Int
    summary: String
    thumb: String
    art: String
    viewCount: Int
    index: Int
    parentIndex: Int
    duration: Int
  }

  type Query {
    latest
    (
      libraryId: ID!
      first: Int = 20
    ): [MediaItem!]!
  }

`;
