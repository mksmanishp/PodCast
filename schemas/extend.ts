import { mergeSchemas } from "@graphql-tools/schema";
import { gql } from "graphql-tag";
import axios from "axios";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const API_KEY = process.env.GEMINI_API_KEY;

export const extendGraphqlSchema = (schema: any) =>
    mergeSchemas({
        schemas: [schema],
        typeDefs: gql`
      type RegisterResponse {
        user: User
      }

      type PodcastRecommendation {
        id: ID!
        title: String!
        video_uri: String
        artwork: String
        lyricist: String
        type: String!
        audio_uri: String
        artist: ArtistInfo
        isFavourite: Boolean!
      }

      type ArtistInfo {
        id: ID!
        name: String!
        bio: String
        photo: String
      }

      extend type Mutation {
        registerUser(
          name: String!
          email: String!
          password: String!
        ): RegisterResponse
      }

      extend type Query {
        getRecommendedPodcasts(userId: ID!): [PodcastRecommendation]
      }
    `,
        resolvers: {
            Mutation: {
                registerUser: async (_root, { name, email, password }, context) => {
                    const existingUser = await context.db.User.findOne({ where: { email } });

                    if (existingUser) {
                        throw new Error("User with this email already exists");
                    }

                    const newUser = await context.db.User.createOne({
                        data: { name, email, password },
                    });

                    return { user: newUser };
                },
            },
            Query: {
                getRecommendedPodcasts: async (_root, { userId }, context) => {
                    try {
                        const user = await context.db.User.findOne({
                            where: { id: userId },
                            query: `
                id 
                favouritePodcasts {
                  id 
                  title 
                  category 
                }
              `,
                        });

                        if (!user) throw new Error("User not found");

                        const favouritePodcasts = user.favouritePodcasts || [];

                        const favouriteCategories = [
                            ...new Set(favouritePodcasts.map((p: any) => p.category)),
                        ];

                        const allPodcasts = await context.db.Podcast.findMany({
                            query: `
                id
                title
                category
                video_url
                artwork
                lyricist
                type
                audio_url
                artist {
                  id
                  name
                  bio
                  photo
                }
              `,
                        });

                        const favouritePodcastIds = favouritePodcasts.map((p: any) => p.id);
                        const availablePodcasts = allPodcasts.filter(
                            (p: any) => !favouritePodcastIds.includes(p.id)
                        );

                        if (!availablePodcasts.length) return [];

                        const prompt = `
You are an AI podcast recommendation system.

The user has listened to these categories: ${favouriteCategories.length ? favouriteCategories.join(", ") : "None"}.

From the following available podcasts, suggest 3 that match their interests:
${availablePodcasts
                                .map(
                                    (p: any) =>
                                        `${p.title} {Category: ${p.category}, Artist: ${p.artist?.name || "Unknown"}}`
                                )
                                .join("\n")}

Return only the title in this JSON format:
{
  "recommendations": ["Title 1", "Title 2", "Title 3"]
}
`;

                        const response = await axios.post(
                            `${GEMINI_API_URL}?key=${API_KEY}`,
                            {
                                contents: [{ parts: [{ text: prompt }] }],
                            },
                            {
                                headers: { "Content-Type": "application/json" },
                            }
                        );

                        const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

                        const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/);
                        if (!jsonMatch) throw new Error("Invalid AI response format");

                        const { recommendations } = JSON.parse(jsonMatch[1]);
                        if (!Array.isArray(recommendations)) {
                            throw new Error("Invalid AI response format");
                        }

                        const matchedPodcasts = allPodcasts.filter((p: any) =>
                            recommendations.includes(p.title)
                        );

                        const podcastsWithArtist = matchedPodcasts.map((podcast: any) => ({
                            ...podcast,
                            isFavourite: favouritePodcastIds.includes(podcast.id),
                            artist: podcast.artist || {
                                id: 123,
                                name: "Silent Thoughts",
                                bio: "internal musings that remain unspoken, a common experience where individuals ponder ideas, feelings, or memories without verbalizing them",
                                photo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLhzlZaT0RLxRS18nkRApATQflrRNYBee84A&s",
                            },
                        }));

                        return podcastsWithArtist;
                    } catch (error) {
                        console.error("Error in AI Podcast Recommendation:", error);
                        throw new Error("Failed to fetch podcasts");
                    }
                },
            },
        },
    });

