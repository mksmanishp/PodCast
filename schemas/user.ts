import { list } from "@keystone-6/core";
import { checkbox, password, relationship, text, timestamp } from "@keystone-6/core/fields"

export const User = list({
    access: {
        operation: {
            query: () => true,
            create: () => true,
            update: ({ session }) => !!session,
            delete: ({ session }) => !!session,
        },
    },
    fields: {
        name: text({ validation: { isRequired: true } }),
        email: text({ validation: { isRequired: true }, isIndexed: "unique" }),
        password: password(),
        favouritePodcasts: relationship({ ref: "Podcast.favouritedBy", many: true }),
        createdAt: timestamp({ defaultValue: { kind: "now" } }),
        isAdmin: checkbox(),
    }
})